import { describe, expect, it } from "vitest";
import { distanceM, durationLabel, jakartaTime, parseCoords, shiftForHour, summarize, type AttendanceRow } from "./absen";

const row = (username: string, work_date: string, clock_in: string, clock_out: string | null): AttendanceRow => ({
  id: 1, username, work_date, shift: "pagi", clock_in, clock_out, in_dist_m: 5, out_dist_m: null, koreksi: null,
});

describe("absen", () => {
  it("measures metres between two points", () => {
    expect(distanceM(-6.2, 106.8, -6.2, 106.8)).toBe(0);
    // 0.001° latitude is about 111 m.
    expect(Math.round(distanceM(-6.2, 106.8, -6.201, 106.8))).toBe(111);
  });

  it("reads coordinates from Google Maps links and typed text", () => {
    expect(parseCoords("-6.917464, 107.619125")).toEqual({ lat: -6.917464, lng: 107.619125 });
    expect(parseCoords("https://www.google.com/maps?q=-6.9,107.6")).toEqual({ lat: -6.9, lng: 107.6 });
    expect(parseCoords("https://www.google.com/maps/place/Rasi+Aksara/@-6.91,107.61,17z/data=!3m1!4b1!4m6!3m5!8m2!3d-6.9175!4d107.6191"))
      .toEqual({ lat: -6.9175, lng: 107.6191 });
    expect(parseCoords("https://www.google.com/maps/@-6.91,107.61,17z")).toEqual({ lat: -6.91, lng: 107.61 });
    expect(parseCoords("https://maps.app.goo.gl/6rYJJFL72y1on9Rr5")).toBeNull();
    expect(parseCoords("Jl. Merdeka 10")).toBeNull();
  });

  it("guesses the shift from the clock-in hour", () => {
    expect(shiftForHour(6)).toBe("pagi");
    expect(shiftForHour(11)).toBe("pagi");
    expect(shiftForHour(13)).toBe("malam");
  });

  it("turns a typed Jakarta time into an instant", () => {
    expect(jakartaTime("2026-10-25", "22.30")).toBe("2026-10-25T15:30:00.000Z");
    expect(jakartaTime("2026-10-25", "7:05")).toBe("2026-10-25T00:05:00.000Z");
    expect(jakartaTime("2026-10-25", "25.00")).toBeNull();
  });

  it("sums a month per staff, counting forgotten clock-outs separately", () => {
    const rows = [
      row("rifky", "2026-10-24", "2026-10-24T00:00:00Z", "2026-10-24T07:30:00Z"),
      row("rifky", "2026-10-25", "2026-10-25T00:00:00Z", null),
      row("sinta", "2026-10-23", "2026-10-23T07:00:00Z", null),
    ];
    expect(summarize(rows, "2026-10-25")).toEqual([
      { username: "rifky", days: 2, minutes: 450, open: 0 },
      { username: "sinta", days: 1, minutes: 0, open: 1 },
    ]);
    expect(durationLabel(450)).toBe("7 j 30 m");
  });
});
