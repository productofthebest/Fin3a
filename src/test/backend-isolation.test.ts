import {describe,it,expect} from "vitest";
import {ownedFinancialRecords} from "@/lib/financial-records.server";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/integrations/supabase/types";
describe("financial read ownership and full pagination",()=>{
 it("scopes every page to the requesting UUID and stabilizes both order keys",async()=>{
  const calls:{user:string;from:number;to:number;orders:string[]}[]=[];
  const client={from:()=>{let user="";const orders:string[]=[];const query={select:()=>query,eq:(key:string,value:string)=>{if(key==="user_id")user=value;return query;},order:(key:string)=>{orders.push(key);return query;},range:async(from:number,to:number)=>{calls.push({user,from,to,orders});return {data:from===0?Array.from({length:1000},(_,i)=>({id:`a-${i}`})):[{id:"a-1000"}],error:null};}};return query;}};
  const rows=await ownedFinancialRecords(client as unknown as SupabaseClient<Database>,"account-a");
  expect(rows).toHaveLength(1001);expect(calls).toEqual([{user:"account-a",from:0,to:999,orders:["occurred_at","id"]},{user:"account-a",from:1000,to:1999,orders:["occurred_at","id"]}]);
 });
});