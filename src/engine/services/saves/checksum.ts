// A small checksum (FNV-1a, 32 bit) to notice a save that was cut short or damaged. It guards against accident,
// not against someone editing their own save. Plain TypeScript.

/** The checksum of `text` as 8 lower-case hex digits. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
