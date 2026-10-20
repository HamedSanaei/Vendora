import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { attributeError, getAttributeDefinitions, saveAttributeDefinition, saveAttributeTerm } from '../api/attributesApi';
import { AdminButton, AdminFeedback, AdminPageHeader } from '../components/AdminUi';
import { attributeCopy } from '../components/attributes/attribute-copy';
import { normalizeAdminLocale, type AdminLocale } from '../i18n';
import type { AttributeDefinition, AttributeNameInput, AttributeTerm } from '../types';

/** Global attribute/term registry with non-destructive archival and existing admin UI primitives. */
export function AdminAttributesPage() {
  const locale = normalizeAdminLocale(useParams().locale);
  const t = attributeCopy[locale];
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState<AttributeDefinition | null>(null);
  const [editingTerm, setEditingTerm] = useState<AttributeTerm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const definition = definitions.find(x => x.id === selected);
  useEffect(() => {
    let cancelled = false;
    void getAttributeDefinitions().then(rows => { if (!cancelled) setDefinitions(rows); })
      .catch(reason => { if (!cancelled) setError(attributeError(reason, locale === 'fa')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locale, revision]);

  /** Persists one registry entry; errors leave the form and original product references untouched. */
  async function save(input: AttributeNameInput, term: boolean): Promise<boolean> {
    if (busy || (term && !definition)) return false;
    setBusy(true); setError('');
    try {
      if (term && definition) {
        const saved = await saveAttributeTerm(definition.id, input, editingTerm?.id);
        setDefinitions(rows => rows.map(row => row.id === definition.id ? { ...row, terms: [...row.terms.filter(x => x.id !== saved.id), saved] } : row));
        setEditingTerm(null);
      } else {
        const saved = await saveAttributeDefinition(input, editing?.id);
        setDefinitions(rows => [...rows.filter(x => x.id !== saved.id), saved]);
        setSelected(saved.id); setEditing(null); setEditingTerm(null);
      }
      toast.success(t.saved); return true;
    } catch (reason) { setError(attributeError(reason, locale === 'fa')); return false; }
    finally { setBusy(false); }
  }

  return <section className="admin-page">
    <AdminPageHeader title={t.globalTitle} description={t.registryIntro} />
    {error && <AdminFeedback tone="error">{error} <AdminButton onClick={() => { setError(''); setLoading(true); setRevision(x => x + 1); }}>{t.retry}</AdminButton></AdminFeedback>}
    {loading && <p role="status">{t.loading}</p>}
    <div className="admin-attribute-registry">
      <article className="admin-panel"><h2>{t.globalTitle}</h2>
        <RegistryForm key={editing?.id ?? 'new'} locale={locale} editing={editing} busy={busy} onSave={input => save(input, false)} onCancel={() => setEditing(null)} />
        <ul className="admin-attribute-list">{definitions.map(row => <li key={row.id}>
          <AdminButton aria-pressed={selected === row.id} variant={selected === row.id ? 'brass' : 'secondary'} disabled={busy} onClick={() => { setSelected(row.id); setEditingTerm(null); }}>{row.name}{!row.isActive ? ` (${t.inactive})` : ''}</AdminButton>
          <AdminButton disabled={busy} onClick={() => setEditing(row)} variant="secondary" aria-label={`${t.edit} ${row.name}`}>{t.edit}</AdminButton>
        </li>)}</ul>
        {!loading && definitions.length === 0 && <p>{t.empty}</p>}
      </article>
      <article className="admin-panel"><h2>{definition ? `${t.values}: ${definition.name}` : t.values}</h2>
        {definition ? <>
          <RegistryForm key={`${selected}-${editingTerm?.id ?? 'new'}`} locale={locale} term editing={editingTerm} busy={busy} onSave={input => save(input, true)} onCancel={() => setEditingTerm(null)} />
          <ul className="admin-attribute-list">{definition.terms.map(term => <li key={term.id}><span>{term.name}{!term.isActive ? ` (${t.inactive})` : ''}</span><AdminButton disabled={busy} variant="secondary" aria-label={`${t.edit} ${term.name}`} onClick={() => setEditingTerm(term)}>{t.edit}</AdminButton></li>)}</ul>
          {definition.terms.length === 0 && <p>{t.noValues}</p>}
        </> : <p>{t.selectDefinition}</p>}
      </article>
    </div>
  </section>;
}

interface RegistryFormProps {
  locale: AdminLocale;
  editing: AttributeTerm | null;
  busy: boolean;
  term?: boolean;
  onSave: (input: AttributeNameInput) => Promise<boolean>;
  onCancel: () => void;
}

/** Shared create/edit form for global attribute names and terms; no duplicated transport or validation UI. */
function RegistryForm({ locale, editing, busy, term, onSave, onCancel }: RegistryFormProps) {
  const t = attributeCopy[locale];
  const [name, setName] = useState(editing?.name ?? '');
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [active, setActive] = useState(editing?.isActive ?? true);
  /** Clears inputs only after the server confirms the mutation succeeded. */
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (await onSave({ name, slug, isActive: active })) { setName(''); setSlug(''); setActive(true); }
  }
  return <form className="admin-form" onSubmit={event => void submit(event)}><fieldset disabled={busy} className="admin-attribute-fieldset admin-attribute-body">
    <label>{term ? t.value : t.name}<input required maxLength={term ? 200 : 100} value={name} onChange={event => setName(event.target.value)} /></label>
    <label>{t.slug}<input maxLength={term ? 220 : 120} value={slug} onChange={event => setSlug(event.target.value)} /></label>
    <label className="admin-attribute-checkbox"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />{t.active}</label>
    <div className="admin-attribute-actions"><AdminButton type="submit" variant="brass">{busy ? t.saving : editing ? t.save : term ? t.addValue : t.add}</AdminButton>{editing && <AdminButton onClick={onCancel} variant="secondary">{t.cancel}</AdminButton>}</div>
  </fieldset></form>;
}
