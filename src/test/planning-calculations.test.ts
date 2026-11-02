import { describe,it,expect } from "vitest";
import { planningProjection,assessAffordability,currentBalance,unmatchedCommitments,goalCalculation,advanceContribution,evidenceInsights } from "@/lib/planning-calculations";
import { assistantAggregates } from "@/lib/assistant-aggregates";
import { collectPages } from "@/lib/pagination";
import { draftImportEligible,recognizedDocumentType,suggestedClassification,transactionIdentity } from "@/lib/document-rules";
import { fixtureRow,fixtureCommitment,syntheticHistory,syntheticBalance,syntheticGoal,TEST_TODAY as today } from "./fixtures/phase4";
const scenario={income_change:0,spending_change:0,purchase:0,savings_contribution:0,budget:null,months:6};
describe("confirmed dated balances",()=>{
 it("never substitutes recorded net for a missing confirmed balance",()=>expect(planningProjection(syntheticHistory(),null,[],scenario,"NGN",today).ready).toBe(false));
 it("rejects stale, future, unconfirmed and other-currency balances",()=>{for(const b of [{...syntheticBalance,as_of:"2026-10-30"},{...syntheticBalance,as_of:"2026-11-01"},{...syntheticBalance,coverage_confirmed:false},{...syntheticBalance,currency:"USD"}])expect(currentBalance([b],"NGN",today)).toBeNull();});
 it("accepts a genuinely confirmed zero balance",()=>expect(currentBalance([{...syntheticBalance,amount:0}],"NGN",today)?.amount).toBe(0));
});
describe("saved-scenario arithmetic",()=>{
 it("reconciles three full monthly averages and baseline projections",()=>{const r=planningProjection(syntheticHistory(),syntheticBalance,[],scenario,"NGN",today);expect(r.ready).toBe(true);if(!r.ready)throw Error(r.reason);expect(r.history.completeMonths).toEqual(["2026-07","2026-08","2026-09"]);expect(r.baselineNet).toBe(200000);expect(r.points[6]?.baseline).toBe(2200000);});
 it("reserves unmatched commitments once and never adds matched/history/settled/other currency",()=>{const c=[fixtureCommitment(),fixtureCommitment({id:"matched",matched_transaction_id:"x"}),fixtureCommitment({id:"history",included_in_history:true}),fixtureCommitment({id:"paid",settled:true}),fixtureCommitment({id:"USD",currency:"USD"})];expect(unmatchedCommitments(c,"NGN",today,"2027-04-30")).toHaveLength(1);const r=planningProjection(syntheticHistory(),syntheticBalance,c,scenario,"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.points[1]?.baseline).toBe(1100000);expect(r.points[6]?.baseline).toBe(2100000);});
 it("savings contributions reduce spendable balance and remain separately owned savings",()=>{const r=planningProjection(syntheticHistory(),syntheticBalance,[],{...scenario,savings_contribution:100000},"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.scenarioNet).toBe(100000);expect(r.points[6]?.scenario).toBe(1600000);expect(r.points[6]?.savings).toBe(600000);expect((r.points[6]?.scenario??0)+(r.points[6]?.savings??0)).toBe(2200000);});
 it("budget override replaces expenses rather than double counting spending changes",()=>{const r=planningProjection(syntheticHistory(),syntheticBalance,[],{...scenario,budget:200000,spending_change:50000},"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.scenarioNet).toBe(300000);});
 it("income loss produces negative flow and finite runway",()=>{const r=planningProjection(syntheticHistory(),syntheticBalance,[],{...scenario,income_change:-500000},"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.scenarioNet).toBe(-300000);expect(r.scenarioRunway).toBe(3.3);});
 it("zero spending does not invent guaranteed infinite runway",()=>{const rows=syntheticHistory().filter(r=>r.type==="income" || r.id==="first");const r=planningProjection(rows,syntheticBalance,[],scenario,"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.history.spending).toBe(0);expect(r.baselineRunway).toBeNull();});
 it("insufficient history produces no forecast",()=>expect(planningProjection([fixtureRow()],syntheticBalance,[],scenario,"NGN",today).ready).toBe(false));
 it("runway accounts for commitments beyond the selected chart horizon",()=>{const r=planningProjection(syntheticHistory(),syntheticBalance,[fixtureCommitment({amount:3000000,due_date:"2027-01-31"})],{...scenario,months:1},"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.scenarioRunway).toBe(3);});
 it.each(["transfer","refund","loan","credit_card_payment"])("%s and all review/status/currency exclusions cannot inflate history",classification=>{const base=syntheticHistory();const extras=[fixtureRow({classification,type:"income",amount:9e8}),fixtureRow({currency:null,amount:9e8}),fixtureRow({currency:"USD",amount:9e8}),fixtureRow({flag:"duplicate",amount:9e8}),fixtureRow({flag:"ambiguous",amount:9e8}),fixtureRow({status:"pending",amount:9e8}),fixtureRow({status:"cleared",amount:9e8})];const r=planningProjection([...base,...extras],syntheticBalance,[],scenario,"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.history.income).toBe(500000);expect(r.history.spending).toBe(300000);});
 it("rejects invalid savings and horizon",()=>{expect(()=>planningProjection(syntheticHistory(),syntheticBalance,[],{...scenario,savings_contribution:-1},"NGN",today)).toThrow();expect(()=>planningProjection(syntheticHistory(),syntheticBalance,[],{...scenario,months:61},"NGN",today)).toThrow();});
});
describe("affordability",()=>{
 it("assesses the original 500,000 purchase using actual confirmed balance",()=>{const r=assessAffordability(syntheticHistory(),syntheticBalance,[],500000,"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.afterPurchase).toBe(500000);expect(r.status).toBe("appears affordable");});
 it("purchase exceeding cash is unaffordable even with positive future income",()=>{const r=assessAffordability(syntheticHistory(),syntheticBalance,[],1100000,"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.status).toBe("unaffordable");});
 it("explicit unmatched commitment can make a purchase risky",()=>{const r=assessAffordability(syntheticHistory(),syntheticBalance,[fixtureCommitment({amount:900000})],500000,"NGN",today);if(!r.ready)throw Error(r.reason);expect(r.status).toBe("potentially risky");expect(r.reservedCommitments).toBe(900000);});
});
describe("stored goal arithmetic",()=>{
 it("progress, remaining, monthly suggestion and completion reconcile",()=>{const g=goalCalculation(syntheticGoal,[{goal_id:syntheticGoal.id,amount:400000,occurred_at:today,currency:"NGN"}],today);expect(g.saved).toBe(400000);expect(g.remaining).toBe(600000);expect(g.progressPercent).toBe(40);expect(g.contributionSlots).toBe(6);expect(g.suggestedContribution).toBe(100000);expect(g.estimatedCompletion).toBe("2027-04-30");});
 it("excludes future and other-currency contributions",()=>expect(goalCalculation(syntheticGoal,[{goal_id:syntheticGoal.id,amount:900000,occurred_at:"2026-11-01",currency:"NGN"},{goal_id:syntheticGoal.id,amount:900000,occurred_at:today,currency:"USD"}],today).saved).toBe(0));
 it("ignores contributions dated before goal inception",()=>expect(goalCalculation(syntheticGoal,[{goal_id:syntheticGoal.id,amount:900000,occurred_at:"2026-10-01",currency:"NGN"}],today).saved).toBe(0));
 it("completed goals never exceed 100 percent",()=>expect(goalCalculation(syntheticGoal,[{goal_id:syntheticGoal.id,amount:1200000,occurred_at:today,currency:"NGN"}],today)).toMatchObject({remaining:0,progressPercent:100,estimatedCompletion:today}));
 it("overdue goals disclose no future intervals",()=>expect(goalCalculation({...syntheticGoal,target_date:"2026-10-01"},[],today)).toMatchObject({overdue:true,suggestedContribution:null}));
 it.each([ ["weekly","2026-11-07"],["monthly","2026-11-30"],["quarterly","2027-01-31"],["yearly","2027-10-31"] ] as const)("%s schedules safely across calendar boundaries",(frequency,expected)=>expect(advanceContribution(today,frequency)).toBe(expected));
});
describe("assistant evidence for seven original examples",()=>{
 const snapshot=()=>assistantAggregates(syntheticHistory(),"NGN",today,[syntheticBalance],[],[syntheticGoal],[]);
 it("last month spending is 300,000",()=>expect(snapshot().lastMonth.spending).toBe(300000));
 it("top category is Transportation",()=>expect(snapshot().lastMonth.categories[0]).toMatchObject({name:"Transportation",total:300000}));
 it("500,000 affordability is server-derived",()=>expect(snapshot().examplePurchase500000).toMatchObject({ready:true,afterPurchase:500000}));
 it("runway is derived from confirmed cash not recorded net",()=>expect(snapshot().baselineProjection).toMatchObject({monthlyNet:200000,runway:null}));
 it("year-to-date transportation covers records before the 12-month averaging series",()=>expect(snapshot().yearToDate.categories[0]?.total).toBe(1000000));
 it("increasing expenses has period-specific numeric evidence, never invented causes",()=>{const r=evidenceInsights([...syntheticHistory(),fixtureRow({id:"increase",amount:50000})],"NGN",today);expect(r.insights.find(i=>i.kind==="spending")?.evidence).toMatchObject({current:350000,previous:300000,period:"2026-09",comparison:"2026-08"});});
 it("monthly goal contribution comes from target/date/progress",()=>expect(snapshot().goals[0]?.suggestedContribution).toBe(166666.67));
 it("aggregate snapshot never carries descriptions, references, notes or merchant strings",()=>expect(JSON.stringify(snapshot())).not.toContain("SYNTHETIC TEST ONLY"));
});
describe("complete pagination",()=>{
 it("reads all 2,005 rows with no dropped boundary records",async()=>{const rows=Array.from({length:2005},(_,i)=>({id:i}));const got=await collectPages(async(a,b)=>({data:rows.slice(a,b+1),error:null}));expect(got).toHaveLength(2005);expect(got.at(-1)?.id).toBe(2004);});
 it("exactly full final page requires an empty terminal page",async()=>{let calls=0;const got=await collectPages(async(a,b)=>{calls++;return{data:[1,2,3,4].slice(a,b+1),error:null};},2);expect(got).toEqual([1,2,3,4]);expect(calls).toBe(3);});
 it("never returns partial totals on page errors",async()=>expect(collectPages(async()=>({data:null,error:{message:"Denied"}}))).rejects.toThrow("Denied"));
});
describe("scanner reviewed eligibility",()=>{
 const draft={txn_date:today,amount:100,currency:"NGN",classification:"regular",duplicate_of:null,review_confirmed:true,status:"pending"};
 it("requires explicit review and a known currency",()=>{expect(draftImportEligible({...draft,review_confirmed:false},today)).toBe(false);expect(draftImportEligible({...draft,currency:null},today)).toBe(false);expect(draftImportEligible(draft,today)).toBe(true);});
 it("never approves duplicate, invalid-date, future or already imported drafts",()=>{for(const patch of [{duplicate_of:"existing"},{txn_date:"2026-02-30"},{txn_date:"2026-11-01"},{status:"confirmed"}])expect(draftImportEligible({...draft,...patch},today)).toBe(false);});
 it.each([["bank statement","statement"],["purchase receipt","receipt"],["POS slip","pos_slip"],["payment receipt","payment_receipt"],["bank teller slip","teller_slip"],["cheque","cheque"]])("recognizes %s",(text,expected)=>expect(recognizedDocumentType(text)).toBe(expected));
 it.each([["refund received","refund"],["loan payment","loan"],["credit card payment","credit_card_payment"],["transfer to own account","transfer"]])("keeps %s outside regular spending",(text,expected)=>expect(suggestedClassification(text)).toBe(expected));
 it("duplicate identity separates currencies and directions",()=>{expect(transactionIdentity({...draft,type:"income"})).not.toBe(transactionIdentity({...draft,type:"expense"}));expect(transactionIdentity({...draft,type:"expense",currency:"USD"})).not.toBe(transactionIdentity({...draft,type:"expense"}));});
});