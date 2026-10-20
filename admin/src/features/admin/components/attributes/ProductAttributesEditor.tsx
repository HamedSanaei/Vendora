import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { attributeError, getAttributeDefinitions, saveAttributeTerm } from '../../api/attributesApi';
import type { AttributeDefinition } from '../../types';
import { adminPath, type AdminLocale } from '../../i18n';
import { AdminButton, AdminFeedback } from '../AdminUi';
import { attributeCopy } from './attribute-copy';
import type { AttributeDraft } from './attribute-drafts';

interface ProductAttributesEditorProps {
  locale: AdminLocale;
  value: AttributeDraft[];
  onChange: (rows: AttributeDraft[]) => void;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}

/** Woo-style ordered global/custom rows, using existing product form controls and persisted shared terms. */
export function ProductAttributesEditor({ locale, value, onChange, disabled, onBusyChange }: ProductAttributesEditorProps) {
  const t = attributeCopy[locale];
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void getAttributeDefinitions().then(rows => { if (!cancelled) { setDefinitions(rows); setError(''); } })
      .catch(reason => { if (!cancelled) setError(attributeError(reason, locale === 'fa')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locale, retry]);

  /** Adds a new local row or one unassigned global definition, without saving the product prematurely. */
  function add(): void {
    const definition = definitions.find(x => x.id === choice);
    onChange([...value, { key: crypto.randomUUID(), catalogAttributeId: definition?.id ?? null,
      name: definition?.name ?? '', termIds: [], valuesText: '', isVisible: true }]);
    setChoice('');
  }

  /** Changes only array order; stable row keys keep inputs and expanded panels intact. */
  function move(index: number, delta: number): void {
    const rows = [...value];
    [rows[index], rows[index + delta]] = [rows[index + delta], rows[index]];
    onChange(rows);
  }

  return <section className="admin-attributes" aria-label={t.title}>
    <div className="admin-panel-heading"><h2>{t.title}</h2><Link to={adminPath(locale, 'attributes')} target="_blank" rel="noopener noreferrer">{t.manage}</Link></div>
    <p className="admin-attribute-help">{t.intro}</p>
    {loading && <p role="status">{t.loading}</p>}
    {error && <AdminFeedback tone="error">{error} <AdminButton onClick={() => { setLoading(true); setRetry(x => x + 1); }}>{t.retry}</AdminButton></AdminFeedback>}
    <fieldset disabled={disabled} className="admin-attribute-fieldset">
      <div className="admin-attribute-toolbar">
        <label>{t.add}<select value={choice} onChange={event => setChoice(event.target.value)}>
          <option value="">{t.custom}</option>
          {definitions.filter(x => x.isActive && !value.some(row => row.catalogAttributeId === x.id)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select></label>
        <AdminButton onClick={add} disabled={value.length >= 30} variant="secondary">{t.add}</AdminButton>
        <AdminButton onClick={() => { setLoading(true); setRetry(x => x + 1); }} disabled={loading} variant="secondary">{t.refresh}</AdminButton>
      </div>
      {value.length === 0 && <p className="admin-attribute-help">{t.empty}</p>}
      {value.map((row, index) => <AttributeRow key={row.key} row={row} locale={locale} definition={definitions.find(x => x.id === row.catalogAttributeId)}
        onChange={updated => onChange(value.map(x => x.key === row.key ? updated : x))}
        onRemove={() => onChange(value.filter(x => x.key !== row.key))}
        up={index > 0 ? () => move(index, -1) : undefined} down={index < value.length - 1 ? () => move(index, 1) : undefined}
        onTermAdded={(id, term) => setDefinitions(current => current.map(x => x.id === id ? { ...x, terms: [...x.terms, term] } : x))}
        onBusyChange={onBusyChange} />)}
    </fieldset>
    <p className="admin-attribute-help">{t.hiddenHelp}</p>
  </section>;
}

interface AttributeRowProps {
  row: AttributeDraft;
  locale: AdminLocale;
  definition?: AttributeDefinition;
  onChange: (row: AttributeDraft) => void;
  onRemove: () => void;
  up?: () => void;
  down?: () => void;
  onTermAdded: (id: string, term: AttributeDefinition['terms'][number]) => void;
  onBusyChange: (busy: boolean) => void;
}

/** A stable collapsible row; adding shared terms never submits the enclosing product form. */
function AttributeRow({ row, locale, definition, onChange, onRemove, up, down, onTermAdded, onBusyChange }: AttributeRowProps) {
  const t = attributeCopy[locale];
  const [newTerm, setNewTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** Persists a reusable term, then selects it on this unsaved product row. Failures keep user input. */
  async function addTerm(): Promise<void> {
    if (!definition || !newTerm.trim() || busy) return;
    setBusy(true); onBusyChange(true); setError('');
    try {
      const term = await saveAttributeTerm(definition.id, { name: newTerm.trim(), isActive: true });
      onTermAdded(definition.id, term);
      onChange({ ...row, termIds: [...row.termIds, term.id] });
      setNewTerm('');
    } catch (reason) { setError(attributeError(reason, locale === 'fa')); }
    finally { setBusy(false); onBusyChange(false); }
  }

  return <details className="admin-attribute-row" open>
    <summary>{definition?.name || row.name || t.custom}</summary>
    <fieldset disabled={busy} className="admin-attribute-fieldset admin-attribute-body">
      {row.catalogAttributeId ? <>
        {definition && !definition.isActive && <p>{t.inactive}</p>}
        <fieldset className="admin-attribute-fieldset"><legend>{t.values}</legend><div className="admin-attribute-terms">
          {definition?.terms.filter(term => term.isActive || row.termIds.includes(term.id)).map(term => <label key={term.id}>
            <input type="checkbox" checked={row.termIds.includes(term.id)} disabled={!term.isActive || !definition.isActive}
              onChange={() => onChange({ ...row, termIds: row.termIds.includes(term.id) ? row.termIds.filter(id => id !== term.id) : [...row.termIds, term.id] })} />
            {term.name}{!term.isActive ? ` (${t.inactive})` : ''}
          </label>)}
        </div></fieldset>
        {definition?.terms.length === 0 && <p className="admin-attribute-help">{t.noValues}</p>}
        {definition?.isActive && <><div className="admin-attribute-toolbar"><label>{t.newValue}<input value={newTerm} maxLength={200} onChange={event => setNewTerm(event.target.value)} /></label>
          <AdminButton onClick={() => void addTerm()} disabled={busy || !newTerm.trim()} variant="secondary">{busy ? t.saving : t.addValue}</AdminButton></div>
          <p className="admin-attribute-help">{t.unsavedTerms}</p></>}
      </> : <div className="admin-form-grid"><label>{t.name}<input maxLength={100} value={row.name} onChange={event => onChange({ ...row, name: event.target.value })} /></label>
        <label>{t.values}<textarea value={row.valuesText} rows={3} onChange={event => onChange({ ...row, valuesText: event.target.value })} /><small>{t.customHelp}</small></label></div>}
      {error && <AdminFeedback tone="error">{error}</AdminFeedback>}
      <label className="admin-attribute-checkbox"><input type="checkbox" checked={row.isVisible} onChange={event => onChange({ ...row, isVisible: event.target.checked })} />{t.visible}</label>
      <div className="admin-attribute-actions"><AdminButton disabled={!up} onClick={up} variant="secondary">{t.up}</AdminButton><AdminButton disabled={!down} onClick={down} variant="secondary">{t.down}</AdminButton><AdminButton onClick={onRemove} variant="danger">{t.remove}</AdminButton></div>
    </fieldset>
  </details>;
}
