/** localStorage is a migration mirror only; never let its failure block primary persistence. */
export function writeWithLegacyMirror(key, value, writePrimary) {
  try { localStorage.setItem(key, value); } catch { /* IndexedDB remains the source of truth. */ }
  return writePrimary();
}
