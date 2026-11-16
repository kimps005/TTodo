export function createReviewConfirmation() {
  let generation = 0;
  return {
    invalidate: () => { generation++; },
    capture: () => {
      const expected = ++generation;
      return () => {
        if (expected !== generation) return false;
        generation++;
        return true;
      };
    },
  };
}
