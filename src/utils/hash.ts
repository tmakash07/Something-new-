/**
 * Generates a standard SHA-256 hash string from question text to check for duplicates
 */
export async function createQuestionHash(questionText: string): Promise<string> {
  const normalized = questionText.trim().toLowerCase().replace(/\s+/g, " ");
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
