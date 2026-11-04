/** Room codes: 6 characters without look-alikes (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

export function randomRoomCode(random: (n: number) => Uint8Array = randomBytes): string {
  const bytes = random(CODE_LENGTH);
  let code = '';
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}
