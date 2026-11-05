import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ byId:vi.fn(), byRef:vi.fn(), refund:vi.fn(), rpc:vi.fn() }));
vi.mock("@/lib/flutterwave.server",()=>({ verifyPaymentById:mocks.byId,verifyPaymentByReference:mocks.byRef,retrieveRefund:mocks.refund }));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{rpc:mocks.rpc}}));
import { processTopupNotice, settleTopup } from "@/lib/ngn-topup.server";
const ref="F3T-10000000-0000-4000-8000-000000000001";
const paid={id:"123",tx_ref:ref,currency:"NGN",amount:200,status:"successful"};
afterEach(()=>vi.resetAllMocks());
describe("webhook provider-before-financial processing",()=>{
  it.each(["successful","pending","failed"])("reverifies %s notification before recording state",async status=>{
    mocks.byId.mockResolvedValue({...paid,status}); mocks.rpc.mockResolvedValue({data:{status},error:null});
    await processTopupNotice({kind:"charge",id:"123",txRef:ref});
    expect(mocks.byId).toHaveBeenCalledWith("123");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_flw_topup_evidence",expect.objectContaining({_amount:200,_status:status,_app_fee:null}));
  });
  it("passes verified identity/reference mismatches for review, not trusted callback amounts",async()=>{
    mocks.byId.mockResolvedValue({...paid,id:"999",tx_ref:"other"});mocks.rpc.mockResolvedValue({data:{status:"review"},error:null});
    await processTopupNotice({kind:"charge",id:"123",txRef:ref});
    expect(mocks.rpc).toHaveBeenCalledWith("apply_flw_topup_evidence",expect.objectContaining({_provider_tx_id:"999",_notice_tx_id:"123",_reference_matches:false}));
  });
  it("retrieves refund independently and correlates original verified charge",async()=>{
    mocks.refund.mockResolvedValue({id:"90",transaction_id:"123",amount_refunded:100,status:"completed"});mocks.byId.mockResolvedValue(paid);mocks.rpc.mockResolvedValue({data:{status:"review"},error:null});
    await processTopupNotice({kind:"refund",id:"90",transactionId:"123"});
    expect(mocks.refund).toHaveBeenCalledWith("90");expect(mocks.byId).toHaveBeenCalledWith("123");
    expect(mocks.rpc).toHaveBeenCalledWith("record_flw_topup_refund",expect.objectContaining({_refund_state:"pending",_amount:100,_matches:true}));
  });
  it("provider refund failure never writes or falls back to successful charge",async()=>{
    mocks.refund.mockRejectedValue(new Error("network"));
    await expect(processTopupNotice({kind:"refund",id:"90",transactionId:"123"})).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.byId).not.toHaveBeenCalled();
  });
  it("manual check uses same evidence/credit path and propagates database error",async()=>{
    mocks.byRef.mockResolvedValue(paid);mocks.rpc.mockResolvedValue({data:null,error:{message:"private"}});
    await expect(settleTopup(ref)).rejects.toThrow("CREDIT_FAILED");expect(mocks.rpc).toHaveBeenCalledWith("apply_flw_topup_evidence",expect.any(Object));
  });
});