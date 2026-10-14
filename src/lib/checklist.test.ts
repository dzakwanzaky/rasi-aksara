import { describe, expect, it } from "vitest";
import { HOURS, SHEETS, readAmount, sheetForTime, tickKeys } from "./checklist";

describe("readAmount", () => {
  it("reads rupiah with thousand dots", () => {
    expect(readAmount("Rp 1.250.000")).toBe(1250000);
    expect(readAmount("1250000")).toBe(1250000);
  });
  it("reads decimals with a comma or a lone dot", () => {
    expect(readAmount("45,2")).toBe(45.2);
    expect(readAmount("45.2")).toBe(45.2);
  });
  it("is null when empty or unreadable", () => {
    expect(readAmount("")).toBeNull();
    expect(readAmount("abc")).toBeNull();
    expect(readAmount(null)).toBeNull();
  });
});

describe("sheetForTime", () => {
  it("picks the checklist for the time of day", () => {
    expect(sheetForTime(7, 10)).toBe("opening");
    expect(sheetForTime(10, 0)).toBe("operasional");
    expect(sheetForTime(14, 10)).toBe("handover");
    expect(sheetForTime(19, 0)).toBe("operasional");
    expect(sheetForTime(21, 40)).toBe("closing");
  });
});

describe("checklist keys", () => {
  it("are unique across all sheets", () => {
    const keys = SHEETS.flatMap((s) => tickKeys(s));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("count hourly rounds only up to the current hour", () => {
    const op = SHEETS.find((s) => s.id === "operasional")!;
    expect(tickKeys(op, 10)).toHaveLength(2 * 6);
    expect(tickKeys(op)).toHaveLength(HOURS.length * 6);
  });
});
