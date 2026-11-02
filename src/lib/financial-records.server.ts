import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { collectPages } from "./pagination";
export async function ownedFinancialRecords(client: SupabaseClient<Database>, userId:string) {
 return collectPages((from,to)=>client.from("transactions").select("id,type,amount,status,classification,currency,occurred_at,flag,description,source,category_id,categories(name,icon)").eq("user_id",userId).order("occurred_at").order("id").range(from,to));
}