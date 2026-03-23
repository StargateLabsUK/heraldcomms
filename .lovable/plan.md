

# Health Check Edge Function

## What it does
A `/functions/v1/health` endpoint that external monitors (UptimeRobot, PagerDuty, etc.) can poll every 30-60 seconds. It checks three components and returns a structured status response.

## Checks performed
1. **Database** — lightweight `SELECT 1` via service-role client
2. **AI provider (Anthropic)** — validates the API key is set and optionally pings the API with a minimal request
3. **Timestamp** — returns server time for latency tracking

## Response format
```json
{
  "status": "healthy" | "degraded" | "down",
  "timestamp": "2026-03-23T03:12:00Z",
  "components": {
    "database": { "status": "up", "latency_ms": 12 },
    "ai_provider": { "status": "up" },
  },
  "version": "1.0.0"
}
```
- `healthy` = all components up
- `degraded` = AI provider down but database up (Herald can still queue reports)
- `down` = database unreachable

## Implementation
**One new file:** `supabase/functions/health/index.ts`
- Uses `createClient` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env
- Checks Anthropic key exists via `Deno.env.get("ANTHROPIC_API_KEY")`
- Runs `supabase.from('herald_reports').select('id').limit(1)` as a DB connectivity test
- Returns 200 for healthy/degraded, 503 for down
- CORS headers included so it can also be called from the Command dashboard later

**No database changes required.** All secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) already exist.

