import { describe, expect, it } from "vitest";
import { fullName, makeBook, scheduleName, shortName } from "./names";
import { matchAccount } from "./jadwal";

const book = makeBook([
  { username: "rafi", full_name: "Rafi Dinno Darmawan", nickname: "Dinno" },
  { username: "bryan", full_name: "Adam Johan Febrian", nickname: "Brian" },
]);

describe("names", () => {
  it("shows the nickname or full name for a login, and the login when it has none", () => {
    expect(shortName(book, "rafi")).toBe("Dinno");
    expect(fullName(book, "bryan")).toBe("Adam Johan Febrian");
    expect(shortName(book, "owner@gmail.com")).toBe("owner@gmail.com");
    expect(shortName(book, null)).toBe("");
  });

  it("names a schedule row by its login, else as typed", () => {
    expect(scheduleName(book, { name: "RAFI", username: "rafi" })).toBe("Dinno");
    expect(scheduleName(book, { name: "PUTRI", username: null })).toBe("Putri");
  });

  it("matches sheet names to logins by nickname or any part of the full name", () => {
    const accounts = [
      { username: "rafi", name: "Rafi Dinno Darmawan", nick: "Dinno" },
      { username: "bryan", name: "Adam Johan Febrian", nick: "Brian" },
      { username: "putri", name: "Putri Serlina Agustin", nick: "Putri" },
      { username: "viona", name: "Viona Najwa Putrivia", nick: "Viona" },
    ];
    expect(matchAccount("DINNO", accounts)).toEqual({ username: "rafi", sure: true });
    expect(matchAccount("BRIAN", accounts)).toEqual({ username: "bryan", sure: true });
    expect(matchAccount("ADAM", accounts)).toEqual({ username: "bryan", sure: true });
    expect(matchAccount("PUTRI", accounts)).toEqual({ username: "putri", sure: true });
  });
});
