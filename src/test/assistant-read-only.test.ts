import { describe, expect, it, vi } from "vitest";
import { readOnlyAssistantOptions } from "@/lib/assistant-read-only";

describe("AI has no administrative or money-changing tools", () => {
  it.each(["admin_user_detail", "admin_update_profile", "admin_set_account_status", "admin_decide_adjustment", "execute_internal_transfer", "execute_currency_swap", "pay_qr_request"])("cannot expose %s to the model", (name) => {
    const execute = vi.fn();
    const attempted = { tools: { [name]: { execute } }, toolChoice: "required", maxOutputTokens: 1200 };
    const options = { ...attempted, ...readOnlyAssistantOptions() };
    expect(Object.keys(options.tools)).toEqual([]);
    expect(options.toolChoice).toBe("none");
    expect(options.maxOutputTokens).toBe(1200);
    expect(execute).not.toHaveBeenCalled();
  });
});