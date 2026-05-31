const ITERATIONS = 100_000;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveKey(password, salt);
  return `${toBase64(salt)}:${toBase64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  const salt = fromBase64(saltB64);
  const bits = await deriveKey(password, salt);
  return timingSafeEqual(bits, fromBase64(hashB64));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  // Cast: @cloudflare/workers-types Pbkdf2Params.salt expects ArrayBuffer, but
  // Uint8Array<ArrayBufferLike> is the actual runtime type — both runtimes accept it.
  const buf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as ArrayBuffer, iterations: ITERATIONS },
    key,
    KEY_LENGTH * 8
  );
  return new Uint8Array(buf);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function toBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
