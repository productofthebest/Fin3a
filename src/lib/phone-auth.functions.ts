import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number.");
const code = z.string().regex(/^\d{6}$/, "Enter the six-digit code.");

function clientIp() {
  return getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export const requestPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone, purpose: z.enum(["signin", "signup"]) }).parse(d))
  .handler(async ({ data }) => {
    const { requestOtp } = await import("./phone-otp.server");
    return requestOtp({ ...data, ip: clientIp() });
  });

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone, code, purpose: z.enum(["signin", "signup"]) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyOtp } = await import("./phone-otp.server");
    const r = await verifyOtp(data);
    return { tokenHash: "tokenHash" in r ? r.tokenHash : "" };
  });

export const requestLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone }).parse(d))
  .handler(async ({ data, context }) => {
    const { requestOtp } = await import("./phone-otp.server");
    return requestOtp({ phone: data.phone, purpose: "link", ip: clientIp(), userId: context.userId });
  });

export const verifyLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone, code }).parse(d))
  .handler(async ({ data, context }) => {
    const { verifyOtp } = await import("./phone-otp.server");
    await verifyOtp({ ...data, purpose: "link", userId: context.userId });
    return { linked: true };
  });

export const getLinkedPhone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("phone_identities").select("phone").eq("user_id", context.userId).maybeSingle();
    return { phone: data?.phone ?? null };
  });
