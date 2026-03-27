import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (isRateLimited(req, { name: "fetch-incidents", maxRequests: 30, windowMs: 60_000 })) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { shift_id, trust_id, callsign, session_date } = await req.json();

    if (!shift_id && !callsign) {
      return new Response(
        JSON.stringify({ error: "shift_id or callsign required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build query for reports
    let query = supabase
      .from("herald_reports")
      .select("*")
      .eq("status", "active")
      .order("latest_transmission_at", { ascending: false, nullsFirst: false });

    if (shift_id && callsign && session_date) {
      const todayStart = session_date + "T00:00:00.000Z";
      query = query.or(
        `shift_id.eq.${shift_id},and(session_callsign.eq.${callsign},created_at.gte.${todayStart})`
      );
    } else if (shift_id) {
      query = query.eq("shift_id", shift_id);
    } else {
      const todayStart = (session_date || new Date().toISOString().slice(0, 10)) + "T00:00:00.000Z";
      query = query.eq("session_callsign", callsign).gte("created_at", todayStart);
    }

    if (trust_id) {
      query = query.eq("trust_id", trust_id);
    }

    const { data: reports, error: reportsErr } = await query;

    if (reportsErr) {
      console.error("Reports fetch error:", reportsErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch reports" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch dispositions for same scope
    let dispQuery = supabase
      .from("casualty_dispositions")
      .select("*");

    if (callsign && session_date) {
      const todayStart = session_date + "T00:00:00.000Z";
      dispQuery = dispQuery
        .eq("session_callsign", callsign)
        .gte("created_at", todayStart);
    } else if (callsign) {
      dispQuery = dispQuery.eq("session_callsign", callsign);
    }

    if (trust_id) {
      dispQuery = dispQuery.eq("trust_id", trust_id);
    }

    const { data: dispositions } = await dispQuery;

    await supabase.from("audit_log").insert({
      action: "incidents_fetched",
      trust_id: trust_id || null,
      details: { shift_id: shift_id || null, callsign: callsign || null, report_count: (reports ?? []).length },
    });

    return new Response(
      JSON.stringify({ reports: reports ?? [], dispositions: dispositions ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-incidents error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
