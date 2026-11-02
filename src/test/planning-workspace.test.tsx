import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {describe,it,expect,vi} from "vitest";
import {PlanningWorkspace} from "@/components/planning-workspace";
import type {getPlanning} from "@/lib/planning.functions";
vi.stubGlobal("ResizeObserver",class{observe(){} unobserve(){} disconnect(){}});
const mocked=vi.hoisted(()=>({balance:vi.fn(async()=>({saved:true})),scenario:vi.fn(async()=>({saved:true})),goal:vi.fn(async()=>({saved:true})),other:vi.fn(async()=>({saved:true}))}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/planning.functions",()=>({saveConfirmedBalance:mocked.balance,saveScenario:mocked.scenario,saveGoal:mocked.goal,saveCommitment:mocked.other,settleCommitment:mocked.other,recordGoalProgress:mocked.other,evaluatePurchase:mocked.other,deletePlanningItem:mocked.other}));
vi.mock("recharts",()=>({ResponsiveContainer:()=>null,LineChart:()=>null,Line:()=>null,XAxis:()=>null,Tooltip:()=>null,CartesianGrid:()=>null}));
function overview():Awaited<ReturnType<typeof getPlanning>>{return{today:"2026-10-31",currency:"NGN",balance:null,balances:[],commitments:[],goals:[],progress:[],scenarios:[],projection:{ready:false,reason:"Confirm balance",history:{completeMonths:[],income:null,spending:null}},insights:{insights:[],period:"2026-09",comparison:"2026-08",assumptions:[]}};}
function mount(view:"planning"|"goals"){render(<QueryClientProvider client={new QueryClient()}><PlanningWorkspace data={overview()} view={view}/></QueryClientProvider>);}
describe("planning controls with in-memory server stubs (not database E2E)",()=>{
 it("only submits the explicit dated amount after coverage confirmation",async()=>{
  mount("planning");const save=screen.getByRole("button",{name:"Save confirmed balance"});expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Available balance (NGN)"),{target:{value:"1000000"}});
  fireEvent.click(screen.getByRole("checkbox",{name:"I confirm this balance covers my available accounts in NGN"}));fireEvent.click(save);
  await waitFor(()=>expect(mocked.balance).toHaveBeenCalledWith({data:{amount:1000000,as_of:"2026-10-31",coverage_confirmed:true}}));
 });
 it("persists goal target, date and monthly contribution, not a guessed account balance",async()=>{
  mount("goals");fireEvent.change(screen.getByLabelText("Goal name"),{target:{value:"Emergency fund"}});fireEvent.change(screen.getByLabelText("Target (NGN)"),{target:{value:"1000000"}});fireEvent.change(screen.getByLabelText("Target date"),{target:{value:"2027-04-30"}});fireEvent.change(screen.getByLabelText("Planned contribution per interval"),{target:{value:"100000"}});fireEvent.click(screen.getByRole("button",{name:"Create goal"}));
  await waitFor(()=>expect(mocked.goal).toHaveBeenCalledWith({data:{name:"Emergency fund",target_amount:1000000,target_date:"2027-04-30",frequency:"monthly",contribution_amount:100000}}));
 });
});