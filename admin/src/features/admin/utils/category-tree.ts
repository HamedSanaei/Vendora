import type { TreeCategory } from '../components/CategoryTree';

/** Cycle-safe closure for disabled parent choices and selection badges, never public product filtering. */
export function descendantCategoryIds(categories: TreeCategory[], root: string): Set<string> {
  const found = new Set<string>(); const queue = [root];
  while (queue.length) {
    const id = queue.shift()!; if (found.has(id)) continue; found.add(id);
    queue.push(...categories.filter(x => x.parentCategoryId === id).map(x => x.id));
  }
  return found;
}
