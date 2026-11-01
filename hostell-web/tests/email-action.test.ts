import { describe, expect, it, vi } from "vitest";

import { CONTINUE_PATH, outcomeForError, readActionParams, runEmailAction } from "@/lib/auth/email-action";

const firebaseError = (code: string) => Object.assign(new Error(`Firebase: raw message (${code}).`), { code });

describe("readActionParams", () => {
  it("reads only mode and oobCode, taking the first of repeated values", () => {
    expect(readActionParams({ mode: ["verifyEmail", "x"], oobCode: "abc", apiKey: "k", continueUrl: "https://evil.example" })).toEqual({ mode: "verifyEmail", oobCode: "abc" });
    expect(readActionParams({})).toEqual({ mode: null, oobCode: null });
  });
});

describe("runEmailAction", () => {
  it("is invalid and never calls Firebase when parameters are missing", async () => {
    const apply = vi.fn();
    expect(await runEmailAction({ mode: null, oobCode: "abc" }, apply)).toBe("invalid");
    expect(await runEmailAction({ mode: "verifyEmail", oobCode: null }, apply)).toBe("invalid");
    expect(await runEmailAction({ mode: "verifyEmail", oobCode: "x".repeat(600) }, apply)).toBe("invalid");
    expect(apply).not.toHaveBeenCalled();
  });

  it("rejects unsupported modes without calling Firebase", async () => {
    const apply = vi.fn();
    for (const mode of ["resetPassword", "recoverEmail", "bogus"]) {
      expect(await runEmailAction({ mode, oobCode: "abc" }, apply)).toBe("unsupported");
    }
    expect(apply).not.toHaveBeenCalled();
  });

  it("succeeds, passing the code to Firebase unchanged and exactly once", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    expect(await runEmailAction({ mode: "verifyEmail", oobCode: "Ab-12_xY" }, apply)).toBe("success");
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("Ab-12_xY");
  });

  it("maps an expired code", async () => {
    const apply = vi.fn().mockRejectedValue(firebaseError("auth/expired-action-code"));
    expect(await runEmailAction({ mode: "verifyEmail", oobCode: "abc" }, apply)).toBe("expired");
  });

  it("maps an invalid or already-used code", async () => {
    const apply = vi.fn().mockRejectedValue(firebaseError("auth/invalid-action-code"));
    expect(await runEmailAction({ mode: "verifyEmail", oobCode: "abc" }, apply)).toBe("used");
  });

  it("maps SDK, config and network errors to a generic failure", async () => {
    const codes = ["auth/invalid-api-key", "auth/invalid-continue-uri", "auth/unauthorized-continue-uri", "auth/network-request-failed", "auth/internal-error"];
    for (const code of codes) {
      expect(await runEmailAction({ mode: "verifyEmail", oobCode: "abc" }, vi.fn().mockRejectedValue(firebaseError(code)))).toBe("failed");
    }
    expect(outcomeForError(new Error("boom"))).toBe("failed");
    expect(outcomeForError("string")).toBe("failed");
    expect(outcomeForError(null)).toBe("failed");
  });
});

describe("CONTINUE_PATH", () => {
  it("is a fixed same-site path", () => {
    expect(CONTINUE_PATH).toBe("/");
  });
});
