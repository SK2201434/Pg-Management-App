import { describe, expect, it } from "vitest";

import { safeDescription } from "@/lib/listings/sanitize";

describe("safeDescription", () => {
  it.each([
    "Call me on 9876543210",
    "Phone: 98765 43210",
    "WhatsApp +91 98765-43210 anytime",
    "+91-98765-43210",
    "Reach us (040) 2345 6789",
    "98765.43210",
    "9 8 7 6 5 4 3 2 1 0",
    "email owner@example.com for details",
    "Visit www.example.com",
    "Chat on wa.me/919876543210",
    "call nine eight seven six five four three two one zero",
  ])("omits %j", (text) => {
    expect(safeDescription(text)).toBeNull();
  });

  it.each([
    "Spacious 2-sharing rooms with attached bathrooms.",
    "Rent starts at 5,000 - 7,500 per month, deposit 10,000.",
    "Built in 2019, 3 floors, 24 rooms and 48 beds.",
    "10 minutes from the metro and 5 minutes from the bus stand.",
    "Home-cooked meals three times a day.",
  ])("keeps %j unchanged", (text) => {
    expect(safeDescription(text)).toBe(text);
  });

  it("returns null for missing, empty or non-string values", () => {
    expect(safeDescription(undefined)).toBeNull();
    expect(safeDescription(null)).toBeNull();
    expect(safeDescription("   ")).toBeNull();
    expect(safeDescription(12345678901)).toBeNull();
  });

  it("tidies whitespace and omits over-long text", () => {
    expect(safeDescription("  Quiet \n  and   clean  ")).toBe("Quiet and clean");
    expect(safeDescription("a ".repeat(600))).toBeNull();
  });
});
