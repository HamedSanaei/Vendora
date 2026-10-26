import { useState } from 'react';

/** Preserves ordered selections through pagination, but resets them when URL search/status/payment filters change, including Back/Forward. */
export function useOrderLabelSelection(filterKey: string) {
  const [state, setState] = useState<{ filterKey: string; ids: string[] }>({ filterKey, ids: [] });
  if (state.filterKey !== filterKey) setState({ filterKey, ids: [] });
  const ids = state.filterKey === filterKey ? state.ids : [];
  /** Changes only the supplied visible page/row; preserves selections made on other pages and never exceeds 100. */
  function toggle(orderIds: string[], checked: boolean) {
    setState(current => {
      const previous = current.filterKey === filterKey ? current.ids : [];
      const next = checked ? [...new Set([...previous, ...orderIds])] : previous.filter(id => !orderIds.includes(id));
      return next.length > 100 ? current : { filterKey, ids: next };
    });
  }
  return { ids, toggle };
}
