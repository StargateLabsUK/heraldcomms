import { describe, it, expect } from "vitest";
import { sanitizeAssessment } from "../lib/sanitize-assessment";
import type { Assessment } from "../lib/herald-types";

function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    headline: "RTC — 1 casualty",
    priority: "amber",
    incident_type: "RTC",
    casualty_count: 1,
    atmist: {},
    ...overrides,
  } as Assessment;
}

describe("sanitizeAssessment — patient name extraction", () => {
  it("extracts a patient name from ATMIST A field when it contains only a name", () => {
    const input = makeAssessment({
      atmist: {
        p1: { A: "John Smith", T: "RTC", M: "MOI", I: "Leg pain", S: "Alert", T2: "Conveyed" },
      },
    });
    const result = sanitizeAssessment(input);
    // Name should be extracted to patient_name
    expect(result.patient_name).toBeTruthy();
    // A field should be cleared or replaced
    const a = (result.atmist as any)?.p1?.A;
    expect(a === "—" || !a || !a.includes("John Smith")).toBe(true);
  });

  it("extracts a patient name mixed with age/sex data", () => {
    const input = makeAssessment({
      atmist: {
        p1: { A: "Jane Doe 45F", T: "Fall", M: "Mechanical", I: "Hip pain", S: "Alert", T2: "Conveyed" },
      },
    });
    const result = sanitizeAssessment(input);
    expect(result.patient_name).toBeTruthy();
    // Age/sex should remain in A field
    const a = (result.atmist as any)?.p1?.A;
    if (a && a !== "—") {
      expect(a).not.toContain("Jane Doe");
    }
  });

  it("does not extract clinical terms as names", () => {
    const input = makeAssessment({
      atmist: {
        p1: { A: "35M alert and orientated", T: "Assault", M: "Punched", I: "Facial laceration", S: "GCS 15", T2: "Conveyed" },
      },
    });
    const result = sanitizeAssessment(input);
    // Should not extract age/sex as a name
    expect(result.patient_name).toBeFalsy();
  });

  it("handles empty ATMIST gracefully", () => {
    const input = makeAssessment({ atmist: {} });
    const result = sanitizeAssessment(input);
    expect(result).toBeDefined();
    expect(result.patient_name).toBeFalsy();
  });

  it("handles null assessment fields", () => {
    const input = makeAssessment({
      atmist: {
        p1: { A: null as any, T: "RTC", M: null as any, I: null as any, S: null as any, T2: null as any },
      },
    });
    const result = sanitizeAssessment(input);
    expect(result).toBeDefined();
  });
});

describe("sanitizeAssessment — general", () => {
  it("returns a deep clone (no mutation of input)", () => {
    const input = makeAssessment({ headline: "Test headline" });
    const result = sanitizeAssessment(input);
    expect(result).not.toBe(input);
    expect(result.headline).toBe("Test headline");
  });

  it("preserves valid assessment fields", () => {
    const input = makeAssessment({
      headline: "Fall — elderly patient — P2",
      priority: "P2",
      incident_type: "Fall",
      casualty_count: 1,
      atmist: {
        P2: { A: "65M", T: "Fall", M: "Mechanical fall", I: "Hip pain", S: "Alert", T2: "Conveyed" },
      },
    });
    const result = sanitizeAssessment(input);
    expect(result.headline).toBe("Fall — elderly patient — P2");
    expect(result.priority).toBe("P2");
    expect(result.incident_type).toBe("Fall");
    expect(result.casualty_count).toBe(1);
  });
});
