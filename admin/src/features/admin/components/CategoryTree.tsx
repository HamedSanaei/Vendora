import { useMemo, useState, type ReactNode } from 'react';
import { AdminButton } from './AdminUi';
import { descendantCategoryIds } from '../utils/category-tree';

export interface TreeCategory { id: string; name: string; slug: string; parentCategoryId: string | null; isActive?: boolean; subtreeProductCount?: number }
interface CategoryTreeProps {
  categories: TreeCategory[];
  mode?: 'single' | 'multiple' | 'browse';
  selectedIds?: string[];
  disabledIds?: string[];
  disabled?: boolean;
  onChange?: (ids: string[]) => void;
  renderActions?: (category: TreeCategory) => ReactNode;
  label?: string;
}

/** One accessible independent-selection hierarchy for product assignments, parent selection and catalog management. */
export function CategoryTree({ categories, mode = 'multiple', selectedIds = [], disabledIds = [], disabled, onChange, renderActions, label = 'دسته‌بندی‌ها' }: CategoryTreeProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [closed, setClosed] = useState<string[]>([]);
  const nodes = useMemo(() => new Map(categories.map(x => [x.id, x])), [categories]);
  const selected = new Set(selectedIds);
  const search = query.trim().replaceAll('ي', 'ی').replaceAll('ك', 'ک').toLocaleLowerCase();

  /** Includes matching nodes with their ancestors so search never detaches a child from its context. */
  const visibleIds = useMemo(() => {
    const result = new Set<string>();
    for (const node of categories) {
      if (search && !`${node.name} ${node.slug}`.replaceAll('ي', 'ی').replaceAll('ك', 'ک').toLocaleLowerCase().includes(search)) continue;
      let current: TreeCategory | undefined = node; const seen = new Set<string>();
      while (current && !seen.has(current.id)) { seen.add(current.id); result.add(current.id); current = nodes.get(current.parentCategoryId ?? ''); }
    }
    return result;
  }, [categories, nodes, search]);

  /** Flattens only expanded branches with bounded visual indentation and complete breadcrumb tooltips. */
  function render(node: TreeCategory, depth: number, path: string[], seen: Set<string>): ReactNode {
    if (seen.has(node.id) || !visibleIds.has(node.id)) return null;
    const nextSeen = new Set([...seen, node.id]);
    const children = categories.filter(x => x.parentCategoryId === node.id);
    const descendants = descendantCategoryIds(categories, node.id);
    const selectedChildren = selectedIds.filter(id => id !== node.id && descendants.has(id)).length;
    const open = Boolean(search) || expanded.includes(node.id) || (!closed.includes(node.id) && selectedChildren > 0);
    const checked = selected.has(node.id);
    const blocked = disabled || disabledIds.includes(node.id) || (mode === 'multiple' && node.isActive === false && !checked);
    return <li key={node.id}>
      <div className="admin-category-tree-row" style={{ paddingInlineStart: `${Math.min(depth, 5) * 12}px` }}>
        <button type="button" className="admin-category-tree-toggle" aria-label={`${open ? 'بستن' : 'بازکردن'} ${node.name}`} aria-expanded={open} disabled={children.length === 0}
          onClick={() => { setExpanded(ids => open ? ids.filter(id => id !== node.id) : [...ids, node.id]); setClosed(ids => open ? [...ids, node.id] : ids.filter(id => id !== node.id)); }}>{children.length ? open ? '−' : '+' : '·'}</button>
        {mode === 'browse' ? <span title={[...path, node.name].join(' ← ')} className="admin-category-tree-name">{node.name}</span> : <label title={[...path, node.name].join(' ← ')} className="admin-category-tree-name">
          <input type={mode === 'single' ? 'radio' : 'checkbox'} name={mode === 'single' ? 'category-parent' : undefined} checked={checked} disabled={blocked}
            onChange={() => onChange?.(mode === 'single' ? [node.id] : checked ? selectedIds.filter(id => id !== node.id) : [...selectedIds, node.id])} />{node.name}</label>}
        {node.isActive === false && <small>غیرفعال</small>}
        {selectedChildren > 0 && <small>{selectedChildren.toLocaleString('fa-IR')} انتخاب در زیرشاخه</small>}
        {node.subtreeProductCount !== undefined && <small>{node.subtreeProductCount.toLocaleString('fa-IR')} محصول در شاخه</small>}
        {renderActions?.(node)}
      </div>
      {open && <ul>{children.map(child => render(child, depth + 1, [...path, node.name], nextSeen))}</ul>}
    </li>;
  }

  return <section className="admin-category-tree" aria-label={label}>
    <div className="admin-category-tree-toolbar"><label>جستجو در دسته‌بندی‌ها<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="نام یا نامک دسته…" /></label>
      <AdminButton variant="secondary" onClick={() => { setExpanded(categories.map(x => x.id)); setClosed([]); }}>بازکردن همه</AdminButton>
      <AdminButton variant="secondary" onClick={() => { setExpanded([]); setClosed(categories.map(x => x.id)); }}>بستن همه</AdminButton></div>
    {mode === 'single' && <AdminButton variant="secondary" disabled={disabled} onClick={() => onChange?.([])}>بدون والد</AdminButton>}
    <ul>{categories.filter(x => !x.parentCategoryId || !nodes.has(x.parentCategoryId)).map(node => render(node, 0, [], new Set()))}</ul>
    {visibleIds.size === 0 && <p>دسته‌ای یافت نشد.</p>}
  </section>;
}
