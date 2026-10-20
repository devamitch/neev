/**
 * AES-256-GCM sealing for BYOK provider keys.
 *
 * The 32-byte key lives only in the function secret PROVIDER_KEY_ENCRYPTION_SECRET
 * (base64). Ciphertext is bound to (user id, provider) as additional authenticated
 * data, so a row copied to another user or provider fails to decrypt.
 * Stored format: "v1.<iv base64>.<ciphertext base64>".
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

let cachedKey: CryptoKey | null = null;

async function sealingKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = Deno.env.get("PROVIDER_KEY_ENCRYPTION_SECRET");
  if (!secret) throw new Error("Key vault is not configured");
  const raw = unb64(secret);
  if (raw.length !== 32) throw new Error("Key vault secret must be 32 bytes");
  cachedKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return cachedKey;
}

export async function sealSecret(plain: string, userId: string, provider: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(`${userId}:${provider}`) },
    await sealingKey(),
    enc.encode(plain),
  );
  return `v1.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

export async function openSecret(sealed: string, userId: string, provider: string): Promise<string> {
  const [version, iv, ct] = sealed.split(".");
  if (version !== "v1" || !iv || !ct) throw new Error("Unsupported sealed key format");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv), additionalData: enc.encode(`${userId}:${provider}`) },
    await sealingKey(),
    unb64(ct),
  );
  return dec.decode(plain);
}

/** "AIza…720E" — enough to recognise a key, never enough to use it. */
export function previewKey(key: string): string {
  const k = key.trim();
  return k.length <= 10 ? "••••" : `${k.slice(0, 4)}…${k.slice(-4)}`;
}
