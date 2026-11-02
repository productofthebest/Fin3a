import type { AnalysisRecord } from "@/lib/financial-analysis";
import type { ConfirmedBalance, Commitment, Goal } from "@/lib/planning-calculations";
/** In-memory test fixtures only. Never imported by app code, migrations or a database seed. */
export const TEST_TODAY="2026-10-31";
export function fixtureRow(patch:Partial<AnalysisRecord>={}):AnalysisRecord{return {id:"test-row",type:"expense",amount:100000,currency:"NGN",status:"completed",classification:"regular",occurred_at:"2026-09-15",flag:null,description:"SYNTHETIC TEST ONLY",source:"manual",category_id:"transport",categories:{name:"Transportation",icon:"🚗"},...patch};}
export function syntheticHistory():AnalysisRecord[]{return [fixtureRow({id:"first",occurred_at:"2026-06-15"}),...["07","08","09"].flatMap(m=>[fixtureRow({id:`salary-${m}`,occurred_at:`2026-${m}-01`,type:"income",amount:500000,category_id:null,categories:null}),fixtureRow({id:`expense-${m}`,occurred_at:`2026-${m}-15`,amount:300000})])];}
export const syntheticBalance:ConfirmedBalance={id:"test-balance",amount:1000000,currency:"NGN",as_of:TEST_TODAY,coverage_confirmed:true};
export function fixtureCommitment(patch:Partial<Commitment>={}):Commitment{return {id:"test-commitment",amount:100000,currency:"NGN",due_date:"2026-11-15",matched_transaction_id:null,included_in_history:false,settled:false,...patch};}
export const syntheticGoal:Goal={id:"test-goal",name:"SYNTHETIC emergency fund",currency:"NGN",target_amount:1000000,target_date:"2027-04-30",frequency:"monthly",contribution_amount:100000,start_date:TEST_TODAY};