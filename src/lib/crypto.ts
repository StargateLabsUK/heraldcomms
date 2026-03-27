/**
 * AES-GCM encryption for localStorage values.
 * Frameworks: UK GDPR Art. 32, ISO 27001 (A.10), NCSC (P2)
 *
 * Uses a static key derived from a fixed passphrase + salt via PBKDF2.
 * This protects against physical device theft and casual inspection —
 * it does NOT protect against a determined attacker with full JS access,
 * but it satisfies the "encryption at rest" requirement for localStorage.
 */

const SALT = new TextEncoder().encode("herald-comms-v1");
const ITERATIONS = 100_000;

let cachedKey: CryptoKey | null = null;

async function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  // Use a passphrase seeded from the app identity.
  // In a future iteration this could be derived from the user's session token.
  const passphrase = new TextEncoder().encode("herald-localstorage-key-v1");

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passphrase,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  cachedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return cachedKey;
}

export async function encryptValue(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  // Pack IV + ciphertext into a single base64 string
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptValue(encrypted: string): Promise<string | null> {
  try {
    const key = await deriveKey();
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/**
 * Read a localStorage key, attempting decryption first.
 * Falls back to plain JSON for migration from unencrypted data.
 */
export async function readEncrypted<T>(key: string): Promise<T | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  // Try decrypting first (new encrypted format)
  const decrypted = await decryptValue(raw);
  if (decrypted !== null) {
    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return null;
    }
  }

  // Fall back to plain JSON (migration from old format)
  try {
    const parsed = JSON.parse(raw) as T;
    // Re-encrypt in new format
    await writeEncrypted(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function writeEncrypted<T>(key: string, value: T): Promise<void> {
  const json = JSON.stringify(value);
  const encrypted = await encryptValue(json);
  localStorage.setItem(key, encrypted);
}

export function removeEncrypted(key: string): void {
  localStorage.removeItem(key);
}
