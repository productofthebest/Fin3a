import { addDays, forecastHistory, percentChange, type AnalysisRecord } from "./financial-analysis";
import { calculateTotals, completedRecords, roundMoney, validFinancialDate, moneyPrecision } from "./financial-calculations";

export type ContributionFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export interface ConfirmedBalance { id: string; amount: number; currency: string; as_of: string; coverage_confirmed: boolean }
export interface Commitment { id: string; amount: number; currency: string; due_date: string; matched_transaction_id: string | null; included_in_history: boolean; settled: boolean }
export interface Goal { id: string; name: string; currency: string; target_amount: number; target_date: string; frequency: ContributionFrequency; contribution_amount: number; start_date: string }
export interface GoalProgress { goal_id: string; amount: number; occurred_at: string; currency: string }
export interface ScenarioInput { income_change: number; spending_change: number; purchase: number; savings_contribution: number; budget: number | null; months: number }
export const PLANNING_ASSUMPTIONS = ["UTC calendar dates", "Completed regular records in the selected currency only; review flags excluded", "First recorded month and current month excluded; zero-activity months included", "History coverage may be incomplete; averages are estimates, not guarantees", "Only explicit unmatched commitments not already included in history are added", "Savings contributions reduce spendable cash, not net worth; no interest, tax or inflation assumed"];
export function currentBalance(balances: ConfirmedBalance[], currency: string, today: string) {
  return balances.filter(b => b.currency === currency && b.as_of === today && b.coverage_confirmed && Number.isFinite(Number(b.amount)) && Number(b.amount) >= 0).sort((a,b) => b.id.localeCompare(a.id))[0] ?? null;
}
export function unmatchedCommitments(commitments: Commitment[], currency: string, start: string, end: string) {
  return commitments.filter(c => c.currency === currency && !c.settled && !c.matched_transaction_id && !c.included_in_history && c.due_date >= start && c.due_date <= end);
}
export function advanceContribution(date: string, frequency: ContributionFrequency, steps = 1) {
  if (frequency === "weekly") return addDays(date, steps * 7);
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  const months = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months * steps);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0,10);
}
export function goalCalculation(goal: Goal, progress: GoalProgress[], today: string) {
  const saved = roundMoney(progress.filter(p => p.goal_id === goal.id && p.currency === goal.currency && validFinancialDate(p.occurred_at) && p.occurred_at >= goal.start_date && p.occurred_at <= today && Number.isFinite(Number(p.amount)) && Number(p.amount) > 0).reduce((s,p) => s + Number(p.amount),0),goal.currency);
  const remaining = roundMoney(Math.max(0, Number(goal.target_amount) - saved),goal.currency);
  // Contributions begin one interval after today; target-date contributions are included.
  let slots = 0;
  for (let i = 1; i <= 5200 && advanceContribution(today,goal.frequency,i) <= goal.target_date; i++) slots++;
  const contribution = Number(goal.contribution_amount);
  const needed = contribution > 0 ? Math.ceil(remaining / contribution) : null;
  const factor=10**moneyPrecision(goal.currency);
  return { saved, remaining, progressPercent: Math.min(100, Math.round(saved / Number(goal.target_amount) * 1000)/10), suggestedContribution: slots ? Math.ceil(remaining / slots * factor) / factor : null, contributionSlots: slots, estimatedCompletion: remaining === 0 ? today : needed && needed <= 5200 ? advanceContribution(today,goal.frequency,needed) : null, overdue: remaining > 0 && goal.target_date < today };
}
export function planningProjection(records: AnalysisRecord[], balance: ConfirmedBalance | null, commitments: Commitment[], input: ScenarioInput, currency: string, today: string) {
  const history = forecastHistory(records,currency,today);
  if (!balance || balance.currency !== currency || balance.as_of !== today || !balance.coverage_confirmed) return { ready: false as const, reason: "Confirm today's available balance and account coverage in this currency.", history };
  if (history.completeMonths.length < 3 || history.income === null || history.spending === null) return { ready: false as const, reason: "At least three complete historical months after the first recorded month are required.", history };
  const values = [input.income_change,input.spending_change,input.purchase,input.savings_contribution,input.months,...(input.budget === null ? [] : [input.budget])];
  if (values.some(v => !Number.isFinite(v)) || input.purchase < 0 || input.savings_contribution < 0 || (input.budget !== null && input.budget < 0) || !Number.isInteger(input.months) || input.months < 1 || input.months > 60 || history.income + input.income_change < 0 || history.spending + input.spending_change < 0) throw new Error("Enter valid nonnegative scenario amounts and 1–60 months.");
  const baselineNet = roundMoney(history.income - history.spending,currency);
  const scenarioSpending = input.budget ?? roundMoney(history.spending + input.spending_change,currency);
  const scenarioNet = roundMoney(history.income + input.income_change - scenarioSpending - input.savings_contribution,currency);
  const points: {month:number;date:string;baseline:number;scenario:number;savings:number;unmatchedCommitments:number}[] = [];
  for (let month = 0; month <= input.months; month++) {
    const through = advanceContribution(today,"monthly",month);
    const due = roundMoney(unmatchedCommitments(commitments,currency,today,through).reduce((s,c) => s + Number(c.amount),0),currency);
    points.push({ month, date: through, baseline: roundMoney(Number(balance.amount) + month * baselineNet - due,currency), scenario: roundMoney(Number(balance.amount) - input.purchase + month * scenarioNet - due,currency), savings: roundMoney(month * input.savings_contribution,currency), unmatchedCommitments: due });
  }
  const depletion = (key: "baseline" | "scenario", net: number) => {
    const starting=Number(balance.amount)-(key==="scenario"?input.purchase:0);
    const events=unmatchedCommitments(commitments,currency,today,advanceContribution(today,"monthly",60)).sort((a,b)=>a.due_date.localeCompare(b.due_date));
    let cash=starting, elapsed=0;
    if(cash<0)return 0;
    for(const event of events){
      const days=(Date.parse(event.due_date)-Date.parse(today))/86400000;
      const time=days/(365.2425/12);
      if(net<0 && cash/-net <= time-elapsed)return Math.round((elapsed+cash/-net)*10)/10;
      cash=roundMoney(cash+(time-elapsed)*net-Number(event.amount),currency);elapsed=time;
      if(cash<0)return Math.round(time*10)/10;
    }
    return net<0?Math.round((elapsed+cash/-net)*10)/10:null;
  };
  return { ready: true as const, history, balance: Number(balance.amount), balanceDate: balance.as_of, baselineNet, scenarioNet, scenarioSpending, baselineRunway: depletion("baseline",baselineNet), scenarioRunway: depletion("scenario",scenarioNet), points, assumptions: [...PLANNING_ASSUMPTIONS,"Runway assumes smooth cash flow at 365.2425/12 days per month; explicit commitments occur on their due dates, up to 60 months"], label: "Projection" as const };
}
export function assessAffordability(records: AnalysisRecord[], balance: ConfirmedBalance | null, commitments: Commitment[], purchase: number, currency: string, today: string) {
  const forecast=planningProjection(records,balance,commitments,{income_change:0,spending_change:0,purchase,savings_contribution:0,budget:null,months:3},currency,today);
  if (!forecast.ready) return { ready:false as const, reason:forecast.reason };
  const first=forecast.points[0]; const month=forecast.points[1];
  const afterPurchase=roundMoney(forecast.balance-purchase,currency);
  const status=afterPurchase < 0 || (first?.scenario ?? 0) < 0 ? "unaffordable" : (month?.scenario ?? 0) < 0 || (forecast.scenarioRunway !== null && forecast.scenarioRunway < 3) ? "potentially risky" : "appears affordable";
  return { ready:true as const, status, afterPurchase, reservedCommitments:month?.unmatchedCommitments ?? 0, estimatedRunway:forecast.scenarioRunway, history:forecast.history, assumptions:PLANNING_ASSUMPTIONS, label:"Estimate" as const };
}
export function evidenceInsights(records: AnalysisRecord[], currency: string, today: string) {
  const now=new Date(`${today}T00:00:00Z`); const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)).toISOString().slice(0,10); const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString().slice(0,10); const before=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-2,1)).toISOString().slice(0,10);
  const a=records.filter(r=>r.occurred_at>=start && r.occurred_at<end); const b=records.filter(r=>r.occurred_at>=before && r.occurred_at<start); const current=calculateTotals(a,currency,today); const previous=calculateTotals(b,currency,today);
  const eligible=completedRecords(records,currency,today);
  const insights: { kind:string; title:string; evidence:Record<string,number|string|null>; why:string; action:string; label:"Actual"|"Estimate" }[]=[];
  const push=(kind:string,title:string,evidence:Record<string,number|string|null>,why:string,action:string)=>insights.push({kind,title,evidence,why,action,label:"Actual"});
  if(completedRecords(a,currency,today).length && completedRecords(b,currency,today).length){
    if(current.spending>previous.spending)push("spending","Recorded spending increased",{current:current.spending,previous:previous.spending,changePercent:percentChange(current.spending,previous.spending),period:start.slice(0,7),comparison:before.slice(0,7)},"Higher spending can reduce financial flexibility.","Review the categories contributing to the increase.");
    if(current.income!==previous.income)push("income","Recorded income changed",{current:current.income,previous:previous.income,period:start.slice(0,7),comparison:before.slice(0,7)},"Changing income affects planned spending.","Check whether the change is recurring or one-off.");
  }
  if(current.recordedNet<0)push("pressure","Spending exceeded income",{income:current.income,spending:current.spending,net:current.recordedNet,period:start.slice(0,7)},"Negative recorded cash flow is not proof of a negative bank balance.","Review commitments and confirm your available balance.");
  const duplicates=records.filter(r=>r.currency===currency && r.flag==="duplicate"); if(duplicates.length)push("duplicates","Potential duplicates await review",{count:duplicates.length},"Flagged records are excluded from regular totals.","Compare original documents before retaining or removing records.");
  const byCategory=new Map<string,{name:string,total:number,count:number}>();
  for(const r of completedRecords(a,currency,today).filter(r=>r.type==="expense")){const key=r.category_id??"none";const c=byCategory.get(key)??{name:r.categories?.name??"Uncategorized",total:0,count:0};c.total=roundMoney(c.total+Number(r.amount),currency);c.count++;byCategory.set(key,c);}
  const top=[...byCategory.values()].sort((x,y)=>y.total-x.total)[0]; if(top)push("pattern","Largest spending category",{category:top.name,spending:top.total,transactions:top.count,period:start.slice(0,7)},"Concentrated spending can indicate a useful budget priority.","Compare this category with your priorities; essentials are not automatically waste.");
  for(const [id,c] of byCategory){const old=calculateTotals(completedRecords(b,currency,today).filter(r=>r.type==="expense"&&(r.category_id??"none")===id),currency,today).spending;if(old>0 && c.total>=old*1.25)push(`category-${id}`,"Category spending rose by at least 25%",{category:c.name,current:c.total,previous:old,changePercent:percentChange(c.total,old),period:start.slice(0,7),comparison:before.slice(0,7)},"This is a recorded comparison, not proof of an unusual or unnecessary purchase.","Review the category transactions and check whether the increase is temporary.");}
  const recurring=new Map<string,Set<string>>();for(const r of eligible.filter(r=>r.type==="expense" && r.category_id)){const key=r.category_id??"none";const months=recurring.get(key)??new Set<string>();months.add(r.occurred_at.slice(0,7));recurring.set(key,months);} const repeated=[...recurring.values()].filter(m=>m.size>=3).length;if(repeated)push("recurring","Categories recur across months",{categories:repeated,minimumMonths:3},"Repeated category spending may contain ongoing obligations; it does not prove a recurring bill.","Review the underlying transactions and mark confirmed commitments.");
  if(current.recordedNet>0)insights.push({kind:"savings",title:"Recorded cash-flow surplus",evidence:{net:current.recordedNet,period:start.slice(0,7)},why:"A recorded surplus may create room for savings, but is not a confirmed available balance.",action:"Confirm coverage and obligations before setting a contribution.",label:"Estimate"});
  return {insights,period:start.slice(0,7),comparison:before.slice(0,7),assumptions:PLANNING_ASSUMPTIONS};
}