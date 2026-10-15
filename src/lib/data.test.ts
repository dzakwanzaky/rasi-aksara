import { describe, expect, it } from "vitest";
import { countDayJakarta } from "./data";

describe("countDayJakarta", () => {
  it("keeps a count made after midnight on the previous day", () => {
    expect(countDayJakarta(new Date("2026-10-15T17:30:00Z"))).toBe("2026-10-15"); // 00:30 WIB, 16 Okt
    expect(countDayJakarta(new Date("2026-10-15T22:59:00Z"))).toBe("2026-10-15"); // 05:59 WIB
  });
  it("starts the new day at 06:00 WIB", () => {
    expect(countDayJakarta(new Date("2026-10-15T23:00:00Z"))).toBe("2026-10-16"); // 06:00 WIB
    expect(countDayJakarta(new Date("2026-10-15T14:00:00Z"))).toBe("2026-10-15"); // 21:00 WIB
  });
});
