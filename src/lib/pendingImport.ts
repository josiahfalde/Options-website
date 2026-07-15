// Hand-off for a file dropped directly on the "Import / Data" nav link:
// Layout stashes the File here and ImportData claims it — on mount after the
// mid-drag navigation, or immediately via the subscriber if the page is
// already open. Deliberately not React state — it's a one-shot baton between
// two components across a navigation.
let pending: File | null = null;
let listener: ((file: File) => void) | null = null;

export function setPendingImportFile(file: File) {
  if (listener) listener(file);
  else pending = file;
}

/** ImportData registers here; also drains any file stashed before mount. */
export function subscribePendingImport(fn: (file: File) => void): () => void {
  listener = fn;
  if (pending) {
    const f = pending;
    pending = null;
    fn(f);
  }
  return () => {
    if (listener === fn) listener = null;
  };
}
