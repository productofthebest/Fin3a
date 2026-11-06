import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PlanningDatabase } from "./planning-types";
import { ownedFinancialRecords } from "./financial-records.server";
import { collectPages } from "./pagination";
import { recordCurrencies } from "./record-currencies";
import { currentBalance, evidenceInsights, goalCalculation, planningProjection } from "./planning-calculations";
export async function planningContext(supabase:SupabaseClient<Database>,userId:string, selectedCurrency?:string) {
 const client=supabase as unknown as SupabaseClient<PlanningDatabase>;
 const today=new Date().toISOString().slice(0,10);
 const settings=await supabase.from("user_settings").select("currency").eq("user_id",userId).single();
 if(settings.error || !settings.data)throw new Error("Choose your currency first.");
 const [records,balances,commitments,goals,progress,scenarios]=await Promise.all([
  ownedFinancialRecords(supabase,userId),
  collectPages((a,b)=>client.from("confirmed_balances").select("*").eq("user_id",userId).order("as_of").order("id").range(a,b)),
  collectPages((a,b)=>client.from("financial_commitments").select("*").eq("user_id",userId).order("id").range(a,b)),
  collectPages((a,b)=>client.from("financial_goals").select("*").eq("user_id",userId).order("id").range(a,b)),
  collectPages((a,b)=>client.from("goal_progress").select("*").eq("user_id",userId).order("id").range(a,b)),
  collectPages((a,b)=>client.from("saved_scenarios").select("*").eq("user_id",userId).order("id").range(a,b)),
 ]);
 const currencies=recordCurrencies(settings.data.currency,[...records,...balances,...commitments,...goals,...scenarios]);
 const currency=selectedCurrency && currencies.includes(selectedCurrency) ? selectedCurrency : settings.data.currency;
 return {client,today,currencies,currency,records,balances,commitments,goals,progress,scenarios,balance:currentBalance(balances,currency,today)};
}
export async function planningOverview(supabase:SupabaseClient<Database>,userId:string, currency?:string) {
 const c=await planningContext(supabase,userId,currency);
 const projection=planningProjection(c.records,c.balance,c.commitments,{income_change:0,spending_change:0,purchase:0,savings_contribution:0,budget:null,months:12},c.currency,c.today);
 return {currencies:c.currencies,currency:c.currency,today:c.today,balance:c.balance,balances:c.balances.filter(b=>b.currency===c.currency),commitments:c.commitments.filter(b=>b.currency===c.currency),goals:c.goals.filter(g=>g.currency===c.currency).map(g=>({...g,...goalCalculation(g,c.progress,c.today)})),progress:c.progress.filter(p=>p.currency===c.currency),scenarios:c.scenarios.filter(s=>s.currency===c.currency).map(s=>({...s,projection:planningProjection(c.records,c.balances.find(b=>b.id===s.balance_id)??null,c.commitments,s,c.currency,c.today)})),projection,insights:evidenceInsights(c.records,c.currency,c.today)};
}