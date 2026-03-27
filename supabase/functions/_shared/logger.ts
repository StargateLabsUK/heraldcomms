/**
 * Structured logging with PII stripping.
 * Frameworks: ISO 27001 (A.12.4), UK GDPR Art. 32
 *
 * Strips potential PII fields from log output to prevent
 * sensitive data leaking into edge function logs.
 */

const PII_FIELDS = new Set([
  "patient_name",
  "name",
  "email",
  "user_email",
  "operator_id",
  "collar_number",
  "nok_notified",
  "safeguarding_concern",
  "clinical_findings",
  "atmist",
  "transcript",
  "password",
  "pin",
  "trust_pin_hash",
]);

function stripPii(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripPii);

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_FIELDS.has(key.toLowerCase())) {
      cleaned[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = stripPii(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function logInfo(fn: string, message: string, data?: Record<string, unknown>): void {
  const entry = {
    level: "info",
    fn,
    msg: message,
    ts: new Date().toISOString(),
    ...(data ? { data: stripPii(data) } : {}),
  };
  console.log(JSON.stringify(entry));
}

export function logError(fn: string, message: string, error?: unknown, data?: Record<string, unknown>): void {
  const entry = {
    level: "error",
    fn,
    msg: message,
    ts: new Date().toISOString(),
    err: error instanceof Error ? error.message : String(error ?? ""),
    ...(data ? { data: stripPii(data) } : {}),
  };
  console.error(JSON.stringify(entry));
}
