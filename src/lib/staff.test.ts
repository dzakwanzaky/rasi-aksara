import { describe, expect, it } from "vitest";
import { accountLabel, loginEmail, staffEmail, validUsername } from "./staff";

describe("staff usernames", () => {
  it("maps a username to its login address and back", () => {
    expect(loginEmail(" Budi ")).toBe("budi@rasiaksara.local");
    expect(staffEmail("Sari.k")).toBe("sari.k@rasiaksara.local");
    expect(accountLabel("budi@rasiaksara.local")).toBe("budi");
  });
  it("leaves real emails alone", () => {
    expect(loginEmail("owner@gmail.com")).toBe("owner@gmail.com");
    expect(accountLabel("owner@gmail.com")).toBe("owner@gmail.com");
  });
  it("checks username format", () => {
    expect(validUsername("budi")).toBe(true);
    expect(validUsername("bu")).toBe(false);
    expect(validUsername("budi santoso")).toBe(false);
    expect(validUsername("_budi")).toBe(false);
  });
});
