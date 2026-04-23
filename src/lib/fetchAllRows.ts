/**
 * Paginated range-based fetcher to bypass Supabase/PostgREST's default 1000-row cap.
 * Pass a function that returns a fresh PostgrestFilterBuilder (so .range() can be applied).
 *
 * Example:
 *   const all = await fetchAllRows(() =>
 *     supabase.from('pending_volunteers').select('*').eq('status', 'approved')
 *   );
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Safety cap to avoid infinite loops
  for (let i = 0; i < 1000; i++) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
