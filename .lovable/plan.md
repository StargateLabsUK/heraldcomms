

# Incident-Based Transmission Logging

## What changes

Currently every "HERALD" confirmation creates a new standalone report. This plan introduces an **incident grouping** model: if a follow-up transmission references the same incident number, it appends to the existing incident rather than creating a duplicate.

## Data model

**New `incident_transmissions` table** — stores each individual transmission as a child of a parent report:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| report_id | uuid FK → herald_reports.id | Parent incident |
| timestamp | timestamptz | When this transmission was confirmed |
| transcript | text | Raw transcript |
| assessment | jsonb | AI assessment for this transmission |
| priority | text | Priority at time of this transmission |
| headline | text | Headline for this entry |
| operator_id | text | Who sent it |
| session_callsign | text | Unit callsign |
| created_at | timestamptz | Default now() |

RLS: same open anon read/insert as `herald_reports`.

**Changes to `herald_reports`** (migration):
- Add `incident_number text` column (nullable) — the extracted job/CAD reference
- Add `transmission_count integer default 1` — quick count for the feed
- Add `latest_transmission_at timestamptz` — tracks last update time

## Assessment extraction

The AI assess function already extracts `incident_number` into `structured.incident_number`. No prompt changes needed — just need to use it.

## Field app flow (LiveTab.tsx)

After AI assessment, before showing the review screen:

1. Read `assessment.structured.incident_number`
2. If it exists and is not null, query Supabase for an existing `herald_reports` row with matching `incident_number` from today
3. **If match found**: set a flag `isFollowUp = true` and store the existing report ID. Show a banner: "FOLLOW-UP — Incident {number}" on the review screen
4. **If no match**: proceed as normal (new report)

On HERALD confirm:
- **New incident**: create report as today, also insert first row into `incident_transmissions`, set `incident_number` on the report
- **Follow-up**: insert into `incident_transmissions` with the existing `report_id`, then UPDATE the parent report's `priority`, `headline`, `assessment`, `latest_transmission_at`, and increment `transmission_count`

## Sync edge function (sync-report)

Update to handle two modes:
- **New report**: upsert into `herald_reports` + insert into `incident_transmissions`
- **Follow-up**: insert into `incident_transmissions` + update parent report fields (priority, headline, assessment, latest_transmission_at, transmission_count)

## Command dashboard

**IncomingFeed**: Show `transmission_count` badge on cards with multiple transmissions. Sort by `latest_transmission_at` instead of `created_at`.

**ReportDetail**: Add a "TRANSMISSION LOG" section at the bottom that fetches and displays all `incident_transmissions` for the selected report, each showing timestamp, transcript snippet, priority at that time, and who sent it. Ordered chronologically.

**Priority auto-update**: When a follow-up comes in with a different priority, the parent report's priority updates to the latest value (e.g., P1 escalation or P3 de-escalation as the incident progresses).

## Realtime

Subscribe to `incident_transmissions` INSERT events in addition to `herald_reports` — when a new transmission arrives for an existing incident, update the report in the local state and flash the card.

## Technical steps

1. Create migration: `incident_transmissions` table + add columns to `herald_reports` + RLS policies
2. Update `sync-report` edge function to handle follow-ups
3. Update `LiveTab.tsx` — incident lookup before review, follow-up confirm logic
4. Update `herald-sync.ts` — include `incident_number` in payload
5. Update `useHeraldCommand.ts` — subscribe to `incident_transmissions`, sort by latest
6. Update `IncomingFeed.tsx` — show transmission count badge
7. Update `ReportDetail.tsx` — add transmission log section at bottom
8. Update `herald-types.ts` — add new fields to interfaces

