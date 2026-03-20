

## Conflict Detection: Session vs Transcript Metadata

### The Problem
When an operator logs in (e.g., service=Ambulance, callsign=Alpha Two) and then records a transmission that mentions different details (e.g., callsign=Tango Seven, service=Police), there's no indication of the mismatch. Both values are saved but conflicts are invisible.

### Proposed Approach: Detect and Surface Mismatches

**1. Add mismatch detection after AI assessment returns**
Compare these field pairs:
- `session.service` vs `assessment.service`
- `session.callsign` vs `assessment.structured.callsign`
- `session.operator_id` vs `assessment.structured.operator_id`

**2. Show mismatch warnings on the review screen (ready state)**
When conflicts exist, display a warning banner above the structured fields highlighting each mismatch, e.g.:
```text
⚠ CALLSIGN MISMATCH
  Session: Alpha Two | Transcript: Tango Seven
```

The operator can then:
- Keep the transcript value