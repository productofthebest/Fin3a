// @vitest-environment node
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { topupFixture } from "./fixtures/flutterwave-db";

describe("isolated Flutterwave database invariants", () => {
  it.skipIf(!process.env["PGHOST"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])(
    "exact credit, duplicate identity, pending/failed and refunds preserve stored history",
    async () => {
    const host = process.env["PGHOST"], key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const backend = new URL(process.env["SUPABASE_URL"] ?? "https://invalid.example");
    expect(["127.0.0.1","localhost","::1"]).toContain(host);
    expect(["127.0.0.1","localhost","::1"]).toContain(backend.hostname);
    if (!host || !key) throw new Error("Isolated credentials unavailable");
    const db = postgres({host,port:Number(process.env["PGPORT"] ?? 5432),database:process.env["PGDATABASE"] ?? "postgres",username:process.env["PGUSER"] ?? "postgres",password:process.env["PGPASSWORD"] ?? "",max:1});
    const account = crypto.randomUUID(), user = crypto.randomUUID();
    const refs = Array.from({length:5},()=>`F3T-${crypto.randomUUID()}`);
    const providerId = String(Date.now());
    const rpc = async (name: string, args: Record<string,unknown>) => {
      const response = await fetch(new URL(`/rest/v1/rpc/${name}`,backend),{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(args)});
      if (!response.ok) throw new Error(`Isolated RPC failed: ${response.status}`);
      return await response.json() as {status:string};
    };
    try {
      expect((await db`select host(inet_server_addr()) as host`)[0]?.["host"]).toBe("127.0.0.1");
      // Fixture is test-runner-only and writes exclusively to the verified local backend.
      await db.begin(async tx => {
        await tx`insert into public.accounts(id,user_id,currency) values(${account},${user},'NGN')`;
        for (const ref of refs) await tx`insert into public.ngn_topup_requests(account_id,user_id,tx_ref,requested_amount,fin3a_fee,bank_name,account_number,expires_at) values(${account},${user},${ref},${topupFixture.requestedAmount},${topupFixture.fee},${topupFixture.bankName},${topupFixture.accountNumber},now()+interval '1 hour')`;
      });
      const charge = async (n:number,id=providerId,amount=200,currency="NGN",status="successful",matches=true) => (await rpc("apply_flw_topup_evidence",{_tx_ref:refs[n],_provider_tx_id:id,_notice_tx_id:id,_currency:currency,_amount:amount,_status:status,_charged_amount:null,_app_fee:null,_merchant_fee:null,_provider_date:null,_reference_matches:matches})).status;
      const snapshot = async () => JSON.stringify(await db`select (select jsonb_agg(l order by id) from public.account_ledger l where user_id=${user}) ledger,(select jsonb_agg(s order by id) from public.payment_fee_snapshots s where user_id=${user}) fees,(select jsonb_agg(e order by e.id) from public.revenue_events e join public.payment_fee_snapshots s on s.id=e.snapshot_id where s.user_id=${user}) revenue`);
      const view = async () => (await db`select status,provider_state,review_state,credited_amount,verified_app_fee from public.ngn_topup_requests where tx_ref=${refs[0] ?? ""}`)[0];
      expect(await charge(0)).toBe("credited");
      expect(await view()).toMatchObject({status:"credited",credited_amount:"150.00",verified_app_fee:null});
      const before = await snapshot();
      expect(await charge(0)).toBe("duplicate");
      expect(await charge(0,providerId,200,"NGN","failed")).toBe("failed");
      expect(await view()).toMatchObject({status:"credited",provider_state:"successful"});
      expect(await charge(1)).toBe("review");
      expect(await charge(2,providerId+"3",199)).toBe("review");
      expect(await charge(3,providerId+"4",200,"USD")).toBe("review");
      expect(await charge(4,providerId+"5",200,"NGN","pending")).toBe("pending");
      expect(await charge(4,providerId+"5",200,"NGN","failed")).toBe("failed");
      expect(await snapshot()).toBe(before);
      const refund = async (suffix:string,amount:number,state:string,status:string,matches=true) => (await rpc("record_flw_topup_refund",{_refund_id:providerId+suffix,_tx_ref:refs[0],_provider_tx_id:providerId,_amount:amount,_refund_status:status,_refund_state:state,_provider_date:null,_charge_amount:200,_charge_currency:"NGN",_charge_status:"successful",_matches:matches})).status;
      expect(await refund("10",100,"pending","completed")).toBe("review");
      expect(await view()).toMatchObject({provider_state:"successful"});
      expect(await refund("10",100,"settled","completed-bank-transfer")).toBe("review");
      expect(await refund("10",100,"settled","completed-bank-transfer")).toBe("duplicate");
      expect(await view()).toMatchObject({provider_state:"partial_refund",status:"credited",review_state:"required",credited_amount:"150.00"});
      expect(await refund("11",150,"settled","completed-bank-transfer")).toBe("review_mismatch");
      expect(await refund("12",100,"settled","completed-bank-transfer",false)).toBe("review_mismatch");
      expect(await refund("13",100,"settled","completed-bank-transfer")).toBe("review");
      expect(await view()).toMatchObject({provider_state:"refunded"});
      expect(await charge(0,providerId,200,"NGN","pending")).toBe("pending");
      expect(await snapshot()).toBe(before);
      expect((await db`select has_function_privilege('authenticated','public.credit_ngn_topup(text,text,numeric)','execute') allowed,has_table_privilege('authenticated','public.flw_webhook_events','insert') writable`)[0]).toEqual({allowed:false,writable:false});
      // Simultaneous duplicate delivery: one credit and one durable duplicate.
      const concurrentRef = `F3T-${crypto.randomUUID()}`;
      await db`insert into public.ngn_topup_requests(account_id,user_id,tx_ref,requested_amount,fin3a_fee,bank_name,account_number,expires_at) values(${account},${user},${concurrentRef},200,50,'Test-only bank','0000000000',now()+interval '1 hour')`;
      const args = {_tx_ref:concurrentRef,_provider_tx_id:providerId+"20",_notice_tx_id:providerId+"20",_currency:"NGN",_amount:200,_status:"successful",_charged_amount:null,_app_fee:null,_merchant_fee:null,_provider_date:null,_reference_matches:true};
      expect((await Promise.all([rpc("apply_flw_topup_evidence",args),rpc("apply_flw_topup_evidence",args)])).map(r=>r.status).sort()).toEqual(["credited","duplicate"]);
      expect((await db`select count(*)::int n from public.account_ledger where account_id=${account} and provider_ref=${providerId+"20"}`)[0]?.["n"]).toBe(1);
    } finally { await db.end(); }
  });
});