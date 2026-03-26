

## Problem Analysis

**Why shift-end doesn't sync to the handheld:**
A previous migration (`20260324120730`) dropped ALL anon policies from the `shifts` table. The handheld uses the anon key (no authenticated session), so `useShiftEndedPoll`'s realtime subscription silently fails — it can't read the `shifts` table at all.

**Your crew model makes perfect sense.** A shift belongs to a vehicle/unit. Multiple crew members link their personal devices with individual collar numbers.

## Plan

### 1. Fix shift-end sync — Add anon SELECT back on `shifts`

New migration to restore read-only anon access on `shifts`. This is the minimum needed for the handheld's realtime subscription to detect `ended_at` being set.

```sql
CREATE POLICY "Allow anon read shifts"
ON public.shifts FOR SELECT TO anon USING (true);
```

### 2. Remove collar number from ShiftLogin (iPad)

In `src/components/herald/ShiftLogin.tsx`:
- Remove the collar number input field entirely
- The iPad starts a shift with just **callsign + vehicle type**
- The shift record in Supabase has no `operator_id` — it's a crew-level record

### 3. Add collar number input to LinkCodeEntry (Handheld)

In `src/components/herald/LinkCodeEntry.tsx`:
- Add a collar number text input that appears **before** the link code entry
- Flow: Enter collar number → Enter 6-digit code → Link
- After redeeming the code, merge the collar number into the session before saving:
  ```ts
  session.operator_id = collarNumber;
  ```
- Each handheld stores its own `operator_id` in localStorage, so reports from that device are tagged to that paramedic

### 4. How the model works

```text
iPad (crew tablet)                 Handheld A              Handheld B
─────────────────                  ──────────              ──────────
Start shift:                       Collar: 1234            Collar: 5678
  Callsign: Alpha Two              Link code: 847291       Link code: 847291
  Vehicle: DCA                     → linked                → linked
  (no collar number)

Reports from A tagged              Reports from B tagged
  operator_id: 1234                  operator_id: 5678

iPad ends shift →                  Realtime detects        Realtime detects
  ended_at set                       ended_at → logout       ended_at → logout
```

- Shift is a shared resource (vehicle/unit level)
- Collar number is per-device (personal identifier)
- Ending shift on iPad sets `ended_at`, all handhelds detect this via realtime and auto-logout

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/new.sql` | Add anon SELECT on `shifts` |
| `src/components/herald/ShiftLogin.tsx` | Remove collar number field |
| `src/components/herald/LinkCodeEntry.tsx` | Add collar number input before code entry |
| `mem://features/crew-model.md` | Document the shift/crew/collar model |

