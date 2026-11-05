import { describe, expect, it, vi } from "vitest";

import { checkResetLink, submitPasswordReset, validateNewPassword } from "@/lib/auth/password-reset";

const firebaseError = (code: string) => Object.assign(new Error(`Firebase: raw message (${code}).`), { code });
const ok = "Strong#Pass1";

describe("validateNewPassword", () => {
  it("accepts a password meeting the registration policy", () => {
    expect(validateNewPassword(ok, ok)).toEqual({});
  });

  it("rejects passwords below policy", () => {
    expect(validateNewPassword("", ok).password).toBeDefined();
    expect(validateNewPassword("Ab#1", "Ab#1").password).toMatch(/at least 6/);
    expect(validateNewPassword("lowercase#1", "lowercase#1").password).toMatch(/capital/);
    expect(validateNewPassword("Capital123", "Capital123").password).toMatch(/symbol/);
    expect(validateNewPassword("A#" + "x".repeat(130), "A#" + "x".repeat(130)).password).toMatch(/at most 128/);
  });

  it("rejects a missing or mismatched confirmation", () => {
    expect(validateNewPassword(ok, "").confirm).toBeDefined();
    expect(validateNewPassword(ok, "Other#Pass1").confirm).toMatch(/do not match/);
  });
});

describe("checkResetLink", () => {
  it("is invalid without calling Firebase when the code is missing or too long", async () => {
    const verify = vi.fn();
    expect(await checkResetLink({ mode: "resetPassword", oobCode: null }, verify)).toEqual({ status: "invalid" });
    expect(await checkResetLink({ mode: "resetPassword", oobCode: "x".repeat(600) }, verify)).toEqual({ status: "invalid" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("is ready when Firebase accepts the code", async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    expect(await checkResetLink({ mode: "resetPassword", oobCode: "abc" }, verify)).toEqual({ status: "ready" });
    expect(verify).toHaveBeenCalledWith("abc");
  });

  it("maps expired, invalid and other errors", async () => {
    const run = (code: string) => checkResetLink({ mode: "resetPassword", oobCode: "abc" }, vi.fn().mockRejectedValue(firebaseError(code)));
    expect(await run("auth/expired-action-code")).toEqual({ status: "expired" });
    expect(await run("auth/invalid-action-code")).toEqual({ status: "invalid" });
    expect(await run("auth/network-request-failed")).toEqual({ status: "failed" });
    expect(await run("auth/internal-error")).toEqual({ status: "failed" });
  });
});

describe("submitPasswordReset", () => {
  it("does not call Firebase when validation fails", async () => {
    const confirm = vi.fn();
    expect(await submitPasswordReset("abc", ok, "Other#Pass1", confirm)).toMatchObject({ status: "rejected" });
    expect(await submitPasswordReset("abc", "short", "short", confirm)).toMatchObject({ status: "rejected" });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("succeeds, passing the code and password to Firebase once", async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    expect(await submitPasswordReset("abc", ok, ok, confirm)).toEqual({ status: "success" });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith("abc", ok);
  });

  it("maps Firebase errors without leaking raw messages", async () => {
    const run = (code: string) => submitPasswordReset("abc", ok, ok, vi.fn().mockRejectedValue(firebaseError(code)));
    expect(await run("auth/expired-action-code")).toEqual({ status: "expired" });
    expect(await run("auth/invalid-action-code")).toEqual({ status: "invalid" });
    expect(await run("auth/weak-password")).toMatchObject({ status: "rejected", fields: { password: expect.any(String) } });
    expect(await run("auth/too-many-requests")).toMatchObject({ status: "rejected", form: expect.stringMatching(/Too many/) });
    expect(await run("auth/network-request-failed")).toMatchObject({ status: "rejected", form: expect.stringMatching(/connection/) });
    const generic = await run("auth/internal-error");
    expect(JSON.stringify(generic)).not.toMatch(/Firebase:|auth\//);
  });
});
