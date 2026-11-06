// @vitest-environment node
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

const port = process.env["ACTIVITY_TEST_PGPORT"];
describe.skipIf(!port)("isolated Activity database retention", () => {
  it("blocks deletion and provenance spoofing, permits imported removal and status updates, and isolates refunds", async () => {
    if (!port || port !== "55439") throw new Error("Dedicated isolated database required");
    const db = postgres({ host: "127.0.0.1", port: Number(port), username: "lovable", database: "activity_retention_test", max: 1 });
    try {
      expect((await db`select current_database() as name, host(inet_server_addr()) as host`)[0]).toEqual({ name: "activity_retention_test", host: "127.0.0.1" });
      await db.unsafe(`CREATE ROLE authenticated; CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        GRANT USAGE ON SCHEMA auth,public TO authenticated;
        CREATE TABLE public.transactions(id text PRIMARY KEY,user_id uuid,source text,import_identity text,source_document_id uuid,status text);
        GRANT SELECT,UPDATE,DELETE ON public.transactions TO authenticated;
        ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY owner_all ON public.transactions TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
        CREATE TABLE public.ngn_topup_requests(id uuid PRIMARY KEY,user_id uuid,status text);
        CREATE TABLE public.flw_topup_refunds(id text,request_id uuid);
        GRANT SELECT ON public.ngn_topup_requests,public.flw_topup_refunds TO authenticated;
        ALTER TABLE public.ngn_topup_requests ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.flw_topup_refunds ENABLE ROW LEVEL SECURITY;
        CREATE POLICY topup_owner ON public.ngn_topup_requests FOR SELECT TO authenticated USING(user_id=auth.uid());`);
      const tables = ["account_ledger","internal_transfers","currency_swaps","ngn_withdrawals","bill_payments","split_bills","split_bill_participants","qr_payment_requests"];
      for (const table of tables) await db.unsafe(`CREATE TABLE public.${table}(id text PRIMARY KEY,status text);`);
      await db.unsafe(await readFile(new URL("../../docs/activity-retention.sql",import.meta.url),"utf8"));
      const a="10000000-0000-0000-0000-000000000001", b="10000000-0000-0000-0000-000000000002";
      await db`insert into transactions values('manual',${a},'manual',null,null,'completed'),('import',${a},'document','draft:1',null,'completed'),('other',${b},'document','draft:2',null,'completed')`;
      await expect(db`delete from transactions where id='manual'`).rejects.toThrow(/cannot be deleted/);
      await expect(db`update transactions set source='document',import_identity='spoof' where id='manual'`).rejects.toThrow(/provenance/);
      await expect(db`update transactions set user_id=${b} where id='manual'`).rejects.toThrow(/provenance/);
      await db`update transactions set status='cleared' where id='manual'`;
      expect((await db`select status from transactions where id='manual'`)[0]?.["status"]).toBe("cleared");
      for (const table of tables) {
        await db.unsafe(`insert into public.${table} values('payment','pending')`);
        await expect(db.unsafe(`delete from public.${table}`)).rejects.toThrow(/cannot be deleted/);
        await db.unsafe(`update public.${table} set status='completed'`);
        expect((await db.unsafe(`select status from public.${table}`))[0]?.["status"]).toBe("completed");
      }
      const reqA="20000000-0000-0000-0000-000000000001", reqB="20000000-0000-0000-0000-000000000002";
      await db`insert into ngn_topup_requests values(${reqA},${a},'credited'),(${reqB},${b},'credited')`;
      await db`insert into flw_topup_refunds values('own',${reqA}),('other',${reqB})`;
      await db`select set_config('request.jwt.claim.sub',${a},false)`;
      await db.unsafe("SET ROLE authenticated");
      expect(await db`delete from transactions where id='manual' returning id`).toHaveLength(0);
      expect(await db`delete from transactions where id='other' returning id`).toHaveLength(0);
      expect((await db`delete from transactions where id='import' returning id`)[0]?.["id"]).toBe("import");
      expect((await db`select id from flw_topup_refunds`).map(r=>r["id"])).toEqual(["own"]);
      await db.unsafe("RESET ROLE");
      await expect(db`delete from ngn_topup_requests where id=${reqA}`).rejects.toThrow(/cannot be deleted/);
    } finally { await db.end(); }
  });
});