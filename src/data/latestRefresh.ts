// A slow earlier read must never restore an obsolete list or privacy setting.
// Apply one complete snapshot, and ignore errors from superseded requests.
export function createLatestRefresh<Input, Snapshot>(load: (input: Input) => Promise<Snapshot>, apply: (snapshot: Snapshot) => void): (input: Input) => Promise<void> {
  let generation = 0;
  return async input => {
    const request = ++generation;
    try {
      const snapshot = await load(input);
      if (request === generation) apply(snapshot);
    } catch (error) {
      if (request === generation) throw error;
    }
  };
}
