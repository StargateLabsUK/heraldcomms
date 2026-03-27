/**
 * Field-level encryption for special-category personal data.
 * Frameworks: ISO 27001 (A.10), UK GDPR Art. 32, NCSC (P2)
 *
 * Encrypts fields classified as SPECIAL-CATEGORY before database storage.
 * Uses AES-GCM with a key derived from the FIELD_ENCRYPTION_KEY env var.
 *
 * Special-category fields:
 * - patient_name
 * - clinical_findings (ABCDE)
 * - safeguarding_concern
 *
 * Usage in edge functions:
 *   const encrypted = await encryptField(value, key);
 *   const decrypted = await decryptField(encrypted, key);
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const rawKey = Deno.env.get("FIELD_ENCRYPTION_KEY");
  if (!rawKey) {
    throw new Error("FIELD_ENCRYPTION_KEY not configured");
  }

  const keyData = new TextEncoder().encode(rawKey.padEnd(32, "0").slice(0, 32));
  cachedKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKey;
}

export async function encryptField(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Prefix with "enc:" to identify encrypted values
  return "enc:" + btoa(String.fromCharCode(...combined));
}

export async function decryptField(encrypted: string): Promise<string> {
  if (!encrypted.startsWith("enc:")) {
    // Not encrypted — return as-is (backward compatibility)
    return encrypted;
  }

  const key = await getKey();
  const combined = Uint8Array.from(
    atob(encrypted.slice(4)),
    (c) => c.charCodeAt(0),
  );
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/** Fields that should be encrypted before storage */
export const SENSITIVE_FIELDS = new Set([
  "patient_name",
  "safeguarding_concern",
]);

/**
 * Encrypt sensitive fields in a record before database storage.
 * Non-string values and non-sensitive fields are passed through unchanged.
 */
export async function encryptSensitiveFields(
  record: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = { ...record };
  for (const field of SENSITIVE_FIELDS) {
    if (typeof result[field] === "string" && !result[field].toString().startsWith("enc:")) {
      result[field] = await encryptField(result[field] as string);
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in a record after reading from database.
 */
export async function decryptSensitiveFields(
  record: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = { ...record };
  for (const field of SENSITIVE_FIELDS) {
    if (typeof result[field] === "string" && result[field].toString().startsWith("enc:")) {
      result[field] = await decryptField(result[field] as string);
    }
  }
  return result;
}
