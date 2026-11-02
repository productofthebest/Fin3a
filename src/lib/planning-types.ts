import type { Database } from "@/integrations/supabase/types";
import type { Commitment, ConfirmedBalance, Goal, GoalProgress, ScenarioInput } from "./planning-calculations";
type Owned<T> = T & { user_id: string; created_at: string };
type Table<T> = { Row: { [K in keyof T]: T[K] }; Insert: { [K in keyof Omit<T,"id"|"created_at">]: T[K] } & { id?:string; created_at?:string }; Update: { [K in keyof T]?: T[K] }; Relationships: [] };
export type SavedScenario = ScenarioInput & { id:string; name:string; currency:string; balance_id:string };
export type PlanningDatabase = Omit<Database,"public"> & { public: Omit<Database["public"],"Tables"> & { Tables: Database["public"]["Tables"] & {
 confirmed_balances: Table<Owned<ConfirmedBalance>>;
 financial_commitments: Table<Owned<Commitment & { name:string }>>;
 financial_goals: Table<Owned<Goal>>;
 goal_progress: Table<Owned<GoalProgress & { id:string }>>;
 saved_scenarios: Table<Owned<SavedScenario>>;
} } };