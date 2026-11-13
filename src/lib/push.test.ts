import { describe, expect, it } from "vitest";
import { jakartaTime, pingDue, roundKeys, roundMessage } from "./push";

describe("jakartaTime", () => {
  it("is UTC+7", () => {
    expect(jakartaTime(new Date("2026-11-14T05:00:00Z"))).toEqual({ date: "2026-11-14", hour: 12, minute: 0 });
    expect(jakartaTime(new Date("2026-11-14T17:30:00Z"))).toEqual({ date: "2026-11-15", hour: 0, minute: 30 });
  });
});

describe("pingDue", () => {
  it("starts a round at minute 0 of a round hour", () => {
    expect(pingDue({ date: "2026-11-14", hour: 12, minute: 0 })).toEqual({ kind: "mulai", hour: 12, slot: "2026-11-14:12:00" });
    expect(pingDue({ date: "2026-11-14", hour: 20, minute: 3 })?.kind).toBe("mulai");
  });
  it("reminds at minute 30", () => {
    expect(pingDue({ date: "2026-11-14", hour: 17, minute: 30 })).toEqual({ kind: "ingat", hour: 17, slot: "2026-11-14:17:30" });
  });
  it("is quiet outside round hours and between pings", () => {
    expect(pingDue({ date: "2026-11-14", hour: 11, minute: 0 })).toBeNull();
    expect(pingDue({ date: "2026-11-14", hour: 9, minute: 0 })).toBeNull();
    expect(pingDue({ date: "2026-11-14", hour: 12, minute: 50 })).toBeNull();
  });
});

describe("roundMessage", () => {
  it("names the hour and counts what is left", () => {
    expect(roundKeys(12)).toContain("operasional:jam12:parkir");
    expect(roundMessage({ kind: "mulai", hour: 10, slot: "" }).title).toBe("Ronde jam 10.00");
    expect(roundMessage({ kind: "ingat", hour: 14, slot: "" }, 2, 6).body).toBe("Baru 2 dari 6 poin. Lengkapi sekarang ya.");
  });
});
