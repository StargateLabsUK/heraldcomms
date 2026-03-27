/**
 * Shared CORS configuration for all edge functions.
 * Frameworks: CE+ (Firewall/Boundary), ISO 27001 (A.13), NCSC (P11)
 *
 * Only allows requests from known Herald origins.
 */

const ALLOWED_ORIGINS = [
  "https://herald.network",
  "https://www.herald.network",
  "https://heraldcomms.vercel.app",
  "https://heraldcomms.lovable.app",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow all Vercel preview deployments for this project
  if (/^https:\/\/heraldcomms[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
