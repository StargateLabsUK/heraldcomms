import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { trust_id, incident_id, reason } = await req.json();

    if (!trust_id || !incident_id) {
      return new Response(JSON.stringify({ error: "trust_id and incident_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reason || typeof reason !== "string" || reason.length < 5) {
      return new Response(JSON.stringify({ error: "Deletion reason required (min 5 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify report belongs to trust
    const { data: report } = await supabase
      .from("herald_reports")
      .select("id, trust_id")
      .eq("id", incident_id)
      .eq("trust_id", trust_id)
      .maybeSingle();

    if (!report) {
      return new Response(JSON.stringify({ error: "Report not found in this trust" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log BEFORE deletion (so we have a record even if deletion succeeds)
    await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "data_deleted",
      trust_id,
      details: {
        incident_id,
        reason,
        deleted_at: new Date().toISOString(),
      },
    });

    // Delete the report (CASCADE will handle transmissions, dispositions, transfers)
    const { error: deleteError } = await supabase
      .from("herald_reports")
      .delete()
      .eq("id", incident_id)
      .eq("trust_id", trust_id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: "Deletion failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, deleted_id: incident_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
