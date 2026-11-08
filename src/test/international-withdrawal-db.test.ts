// @vitest-environment node
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const port = process.env["INTERNATIONAL_TEST_PGPORT"];
describe.skipIf(!port)("isolated international withdrawal SQL", () => {
  const db = postgres({ host: "127.0.0.1", port: 55440, username: "lovable", database: "international_withdrawal_test", max: 5 });
  const user = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002";
  const acc = "20000000-0000-4000-8000-000000000001";
  let originalNgn: string;
  beforeAll(async () => {
    if (port !== "55440") throw new Error("Dedicated isolated database required");
    expect((await db`select current_database() as name,host(inet_server_addr()) as host`)[0]).toEqual({ name: "international_withdrawal_test", host: "127.0.0.1" });
    await db.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${user}'::uuid AND $2='admin' $$;
      CREATE FUNCTION public.admin_require() RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Forbidden'; END IF; END $$;
      CREATE FUNCTION public.account_blocked(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE TABLE accounts(id uuid primary key,user_id uuid,currency text);
      CREATE TABLE account_ledger(id uuid primary key default gen_random_uuid(),account_id uuid,user_id uuid,currency text,kind text,status text,amount numeric);
      CREATE TABLE user_settings(user_id uuid,country text);
      CREATE TABLE admin_audit_log(id uuid default gen_random_uuid(),admin_id uuid,action text,target_user_id uuid,detail jsonb);
      CREATE TABLE ngn_withdrawals(id uuid primary key,status text,amount numeric);
      CREATE FUNCTION public.reserve_ngn_withdrawal() RETURNS text LANGUAGE sql AS $$ SELECT 'untouched' $$;
      INSERT INTO ngn_withdrawals VALUES(gen_random_uuid(),'successful',500);
      INSERT INTO accounts VALUES('${acc}','${user}','GHS'),('20000000-0000-4000-8000-000000000002','${user}','NGN');
      INSERT INTO account_ledger(account_id,user_id,currency,kind,status,amount) VALUES('${acc}','${user}','GHS','deposit','completed',1000);
      INSERT INTO user_settings VALUES('${user}','GH');`);
    originalNgn = JSON.stringify(await db`select * from ngn_withdrawals`);
    await db.unsafe(await readFile(new URL("../../docs/international-withdrawals.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => { await db.end(); });
  async function reserve(key: string, amount = 10000) {
    return (await db`select reserve_international_withdrawal(${user},'flw:GH:GHS:bank',${key}::uuid,${amount}::bigint,'{"accountName":"Ama","bankCode":"001","accountNumber":"12345678"}'::jsonb) as result`)[0]?.["result"];
  }
  async function finish(ref: string, id: string, status: string, amount = 9950, currency = "GHS") {
    return (await db`select finish_international_withdrawal(${ref},${id},${status},${amount}::bigint,${currency}) as result`)[0]?.["result"];
  }
  const key = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  it("applies additively with global gate OFF and leaves NGN records/functions untouched", async () => {
    expect((await db`select international_payouts_live_enabled() as enabled`)[0]?.["enabled"]).toBe(false);
    expect(await reserve(key(1))).toEqual({ status: "locked" });
    expect(await db`select * from international_withdrawals`).toHaveLength(0);
    expect(JSON.stringify(await db`select * from ngn_withdrawals`)).toBe(originalNgn);
    expect((await db`select reserve_ngn_withdrawal() as value`)[0]?.["value"]).toBe("untouched");
  });
  it("allows admin evidence only after database authorization and leaves routes absent by default", async () => {
    expect(await db`select * from international_merchant_routes`).toHaveLength(0);
    await expect(db`select admin_verify_international_route('flw:GH:GHS:bank','GH','GHS','bank','production','flw-v3-gh-bank-momo-1',ARRAY['001'],'approval',now()+interval '1 day',50,100000,false)`).rejects.toThrow(/Forbidden/);
    await db.begin(async sql => {
      await sql`select set_config('request.jwt.claim.sub',${user},true)`;
      await sql`select admin_verify_international_route('flw:GH:GHS:bank','GH','GHS','bank','production','flw-v3-gh-bank-momo-1',ARRAY['001'],'approval',now()+interval '1 day',50,100000,false)`;
    });
    expect(await db`select * from admin_audit_log`).toHaveLength(1);
  });
  it("rejects unverified routes even when the test-only gate is enabled", async () => {
    // This override exists ONLY in the dedicated loopback test database.
    await db.unsafe("CREATE OR REPLACE FUNCTION public.international_payouts_live_enabled() RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$");
    expect((await db`select reserve_international_withdrawal(${user},'flw:KE:KES:bank',${key(2)}::uuid,10000,'{}') as result`)[0]?.["result"]).toEqual({ status: "route_unverified" });
  });
  it("serializes repeated idempotency keys and rejects changed terms", async () => {
    const results = await Promise.all([reserve(key(3)), reserve(key(3))]);
    expect(results.map(r => r.status).sort()).toEqual(["existing", "reserved"]);
    expect(await db`select * from international_withdrawal_ledger`).toHaveLength(1);
    await expect(reserve(key(3),10001)).rejects.toThrow(/Idempotency conflict/);
  });
  it("prevents overspending under concurrent reservations", async () => {
    const results = await Promise.all([reserve(key(4),80000), reserve(key(5),80000)]);
    expect(results.map(r => r.status).sort()).toEqual(["insufficient","reserved"]);
  });
  it("rejects amount, currency and provider identity mismatches", async () => {
    const w = (await db`select reference from international_withdrawals where idempotency_key=${key(3)}::uuid`)[0];
    if (!w) throw new Error("no test withdrawal");
    await expect(finish(w["reference"],"10","successful",9951)).rejects.toThrow(/mismatch/);
    await expect(finish(w["reference"],"10","successful",9950,"USD")).rejects.toThrow(/mismatch/);
    expect(await finish(w["reference"],"10","pending")).toEqual({ status: "pending" });
    await expect(finish(w["reference"],"11","successful")).rejects.toThrow(/identity mismatch/);
  });
  it("settles exactly once without rewriting the reservation ledger", async () => {
    const w = (await db`select reference from international_withdrawals where idempotency_key=${key(3)}::uuid`)[0];
    if (!w) throw new Error("no withdrawal");
    const before = await db`select * from international_withdrawal_ledger order by id`;
    expect(await finish(w["reference"],"10","successful")).toEqual({ status: "successful" });
    expect(await finish(w["reference"],"10","successful")).toEqual({ status: "successful", duplicate: true });
    expect(await db`select * from international_withdrawal_ledger order by id`).toEqual(before);
  });
  it("releases once only after verified failure", async () => {
    const w = (await db`select reference,payout_minor from international_withdrawals where amount_minor=80000`)[0];
    if (!w) throw new Error("no withdrawal");
    expect(await finish(w["reference"],"20","failed",Number(w["payout_minor"]))).toEqual({ status: "failed" });
    expect((await finish(w["reference"],"20","failed",Number(w["payout_minor"]))).duplicate).toBe(true);
    expect(await db`select * from international_withdrawal_ledger where kind='release'`).toHaveLength(1);
  });
  it("holds post-settlement reversals for authorized review then posts a separate reversal", async () => {
    const w = (await db`select id,reference from international_withdrawals where idempotency_key=${key(3)}::uuid`)[0];
    if (!w) throw new Error("no withdrawal");
    expect(await finish(w["reference"],"10","reversed")).toEqual({ status: "review" });
    expect(await db`select * from international_withdrawal_ledger where kind='reversal'`).toHaveLength(0);
    await expect(db`select admin_review_international_reversal(${w["id"]},10000,'Provider returned full amount')`).rejects.toThrow(/Forbidden/);
    await db.begin(async sql => {
      await sql`select set_config('request.jwt.claim.sub',${user},true)`;
      await sql`select admin_review_international_reversal(${w["id"]},10000,'Provider returned full amount')`;
    });
    expect(await db`select * from international_withdrawal_ledger where kind='reversal'`).toHaveLength(1);
    expect((await finish(w["reference"],"10","reversed")).duplicate).toBe(true);
  });
  it("prevents ledger/event mutation and withdrawal deletion", async () => {
    await expect(db`update international_withdrawal_ledger set amount_minor=1`).rejects.toThrow(/immutable/);
    await expect(db`delete from international_withdrawal_events`).rejects.toThrow(/immutable/);
    await expect(db`delete from international_withdrawals`).rejects.toThrow(/immutable/);
  });
  it("denies customer reserve/finish RPCs and cross-user withdrawal reads", async () => {
    expect((await db`select has_function_privilege('authenticated','reserve_international_withdrawal(uuid,text,uuid,bigint,jsonb)','execute') as allowed`)[0]?.["allowed"]).toBe(false);
    expect((await db`select has_function_privilege('anon','finish_international_withdrawal(text,text,text,bigint,text)','execute') as allowed`)[0]?.["allowed"]).toBe(false);
    await db.begin(async sql => {
      await sql`select set_config('request.jwt.claim.sub',${other},true)`;
      await sql.unsafe("SET LOCAL ROLE authenticated");
      expect(await sql`select * from international_withdrawals`).toHaveLength(0);
      expect(await sql`select * from international_withdrawal_ledger`).toHaveLength(0);
    });
    expect(JSON.stringify(await db`select * from ngn_withdrawals`)).toBe(originalNgn);
  });
});