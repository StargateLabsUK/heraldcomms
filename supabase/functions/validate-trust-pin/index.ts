import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting: simple in-memory tracker
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(JSON.stringify({ error: "Too many attempts — try again later" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pin } = await req.json();
    if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 20) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all active trusts and compare with bcrypt
    const { data: trusts, error } = await supabase
      .from("trusts")
      .select("id, name, slug, active, trust_pin_hash")
      .eq("active", true);

    if (error || !trusts || trusts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Trust code not recognised — check with your station manager" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try bcrypt comparison first, fall back to SHA-256 for legacy hashes
    let matchedTrust = null;

    for (const trust of trusts) {
      try {
        // Try bcrypt first
        if (trust.trust_pin_hash.startsWith("$2")) {
          const matches = await bcrypt.compare(pin, trust.trust_pin_hash);
          if (matches) {
            matchedTrust = trust;
            break;
          }
        } else {
          // Legacy SHA-256 fallback
          const data = new TextEncoder().encode(pin);
          const hash = await crypto.subtle.digest("SHA-256", data);
          const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
          if (hex === trust.trust_pin_hash) {
            matchedTrust = trust;
            // Upgrade to bcrypt
            const bcryptHash = await bcrypt.hash(pin);
            await supabase
              .from("trusts")
              .update({ trust_pin_hash: bcryptHash })
              .eq("id", trust.id);
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!matchedTrust) {
      return new Response(
        JSON.stringify({ error: "Trust code not recognised — check with your station manager" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        trust_id: matchedTrust.id,
        trust_name: matchedTrust.name,
        trust_slug: matchedTrust.slug,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
