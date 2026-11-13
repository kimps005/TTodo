// A review hint only: this score must never merge or discard user tasks.
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const grams = (text: string) => {
  const chars = Array.from(text);
  return new Set(chars.slice(0, -2).map((_, index) => chars.slice(index, index + 3).join('')));
};
export function resemblesEvidence(source: string, evidence: string): boolean {
  const current = normalize(source), previous = normalize(evidence);
  const length = Array.from(previous).length;
  if (length < 8 || !current) return false;
  if (current.includes(previous)) return true;
  if (length < 16) return false;
  // Different dates, amounts and identifiers should not be treated as the same action.
  const sourceNumbers = new Set(source.normalize('NFKC').match(/\d+/g) ?? []);
  if ((evidence.normalize('NFKC').match(/\d+/g) ?? []).some(value => !sourceNumbers.has(value))) return false;
  const a = grams(current), b = grams(previous);
  return b.size >= 10 && [...b].filter(value => a.has(value)).length / b.size >= .93;
}
export interface SimilarCapture { analysis_id: string; title: string; received_at: string; saved: boolean; }
