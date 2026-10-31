import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES, VERIFY_MESSAGES, checkOtp, generateOtp, hashOtp, phoneLoginEmail, sendBlockReason,
} from "./phone-otp";

type Purpose = "signin" | "signup" | "link";

function secret() {
  const s = process.env["OTP_HASH_SECRET"];
  if (!s) throw new Error("Phone sign-in is not configured.");
  return s;
}

export async function findPhoneUser(phone: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("phone_identities").select("user_id").eq("phone", phone).maybeSingle();
  return data?.user_id ?? null;
}

async function sendTermii(phone: string, code: string) {
  const apiKey = process.env["TERMII_API_KEY"];
  if (!apiKey) throw new Error("SMS delivery is not configured.");
  const base = (process.env["TERMII_BASE_URL"] || "https://v3.api.termii.com").replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/sms/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey, to: phone.replace(/\D/g, ""), from: "FIN3A", type: "plain", channel: "generic",
        sms: `Your Fin3a verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Do not share it.`,
      }),
    });
  } catch (e) {
    console.error("Termii network error", e);
    throw new Error("We couldn't reach the SMS service. Please try again shortly.");
  }
  const body = await res.text();
  if (!res.ok) {
    console.error("Termii send failed", res.status, body.slice(0, 300));
    const m = body.toUpperCase();
    if (m.includes("SENDER_ID")) throw new Error("SMS sign-in is temporarily unavailable: our sender name is awaiting approval. Please use email for now.");
    if (m.includes("BALANCE") || m.includes("INSUFFICIENT")) throw new Error("SMS sign-in is temporarily unavailable. Please use email for now.");
    if (m.includes("NUMBER") || m.includes("RECIPIENT") || m.includes("INVALID")) throw new Error("This phone number couldn't receive SMS. Check the number and try again.");
    throw new Error("We couldn't send the SMS code right now. Please try again later or use email.");
  }
}

export async function requestOtp(opts: { phone: string; purpose: Purpose; ip: string | null; userId?: string }) {
  const { phone, purpose, ip, userId } = opts;
  const existing = await findPhoneUser(phone);
  if (purpose === "signin" && !existing) throw new Error("No Fin3a account uses this number yet. Create an account first.");
  if (purpose === "signup" && existing) throw new Error("This number already has an account. Sign in instead.");
  if (purpose === "link" && existing && existing !== userId) throw new Error("This number is already linked to another account.");

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const [last, phoneCount, ipCount] = await Promise.all([
    supabaseAdmin.from("phone_otps").select("created_at").eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("phone_otps").select("id", { count: "exact", head: true }).eq("phone", phone).gte("created_at", hourAgo),
    ip ? supabaseAdmin.from("phone_otps").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", hourAgo) : Promise.resolve({ count: 0 }),
  ]);
  const block = sendBlockReason({
    lastSentAt: last.data ? new Date(last.data.created_at).getTime() : null,
    phoneSendsLastHour: phoneCount.count ?? 0, ipSendsLastHour: ipCount.count ?? 0,
  }, Date.now());
  if (block) throw new Error(block);

  const code = generateOtp();
  // Invalidate older codes for this number, then store only the hash.
  await supabaseAdmin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("phone", phone).is("consumed_at", null);
  const { data: row, error } = await supabaseAdmin.from("phone_otps").insert({
    phone, purpose, ip, user_id: userId ?? null, code_hash: await hashOtp(secret(), phone, code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  }).select("id").single();
  if (error) throw new Error("Couldn't start verification. Please try again.");
  try { await sendTermii(phone, code); } catch (e) {
    await supabaseAdmin.from("phone_otps").delete().eq("id", row.id); // don't charge failed sends against limits
    throw e;
  }
  return { ok: true as const };
}

export async function verifyOtp(opts: { phone: string; code: string; purpose: Purpose; userId?: string }) {
  const { phone, code, purpose, userId } = opts;
  const { data: rec } = await supabaseAdmin.from("phone_otps").select("id, code_hash, attempts, expires_at, consumed_at, purpose, user_id")
    .eq("phone", phone).is("consumed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (rec && (rec.purpose !== purpose || (purpose === "link" && rec.user_id !== userId))) throw new Error(VERIFY_MESSAGES.missing);
  const outcome = checkOtp(rec, await hashOtp(secret(), phone, code), Date.now());
  if (outcome !== "ok") {
    if (outcome === "wrong" && rec) {
      const attempts = rec.attempts + 1;
      await supabaseAdmin.from("phone_otps").update({ attempts }).eq("id", rec.id);
      const left = OTP_MAX_ATTEMPTS - attempts;
      throw new Error(left > 0 ? `That code is incorrect. ${left} attempt${left === 1 ? "" : "s"} left.` : VERIFY_MESSAGES.locked);
    }
    throw new Error(VERIFY_MESSAGES[outcome]);
  }
  // Atomically consume; a concurrent verify loses.
  const { data: consumed } = await supabaseAdmin.from("phone_otps").update({ consumed_at: new Date().toISOString() })
    .eq("id", rec!.id).is("consumed_at", null).select("id");
  if (!consumed?.length) throw new Error(VERIFY_MESSAGES.missing);

  if (purpose === "link") {
    const owner = await findPhoneUser(phone);
    if (owner && owner !== userId) throw new Error("This number is already linked to another account.");
    await supabaseAdmin.from("phone_identities").upsert({ user_id: userId!, phone, verified_at: new Date().toISOString() }, { onConflict: "user_id" });
    return { linked: true as const };
  }

  let uid = await findPhoneUser(phone);
  if (!uid) {
    if (purpose !== "signup") throw new Error("No Fin3a account uses this number yet.");
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email: phoneLoginEmail(phone), email_confirm: true, user_metadata: { phone_login: phone } });
    if (error || !data.user) throw new Error("Couldn't create your account. Please try again.");
    uid = data.user.id;
    const { error: idErr } = await supabaseAdmin.from("phone_identities").insert({ user_id: uid, phone });
    if (idErr) { await supabaseAdmin.auth.admin.deleteUser(uid); throw new Error("This number already has an account. Sign in instead."); }
  }
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
  const email = u.user?.email;
  if (!email) throw new Error("This account can't sign in by phone. Use email instead.");
  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link.properties?.hashed_token) throw new Error("Couldn't start your session. Please try again.");
  return { tokenHash: link.properties.hashed_token };
}
