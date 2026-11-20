/**
 * Token sesi bertanda tangan HMAC-SHA256.
 * Modul ini harus aman dipakai di Edge (middleware) maupun Node.
 * Tidak memakai node:crypto — pakai Web Crypto.
 */

export const SESSION_COOKIE = "sysselect_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 jam

export type SessionPayload = {
  uid: number;
  username: string;
  rank: number;
  exp: number;
};

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET tidak diset atau terlalu pendek.");
  }
  return value;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(
  payload: Omit<SessionPayload, "exp">,
): Promise<string> {
  const body: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(body)));
  const signature = toBase64Url(await hmac(encoded));
  return `${encoded}.${signature}`;
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  try {
    const expected = await hmac(encoded);
    if (!timingSafeEqual(expected, fromBase64Url(signature))) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encoded)),
    ) as SessionPayload;

    if (
      typeof payload.uid !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.rank !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
