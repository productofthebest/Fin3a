import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ChartNoAxesCombined, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminShell({ children, section }: { children: ReactNode; section: "overview" | "ai" | "revenue" }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className={`border-b border-sidebar-border bg-sidebar p-4 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:border-r lg:border-b-0 ${collapsed ? "lg:w-20" : "lg:w-60"}`}>
        <div className="flex items-center justify-between gap-2">
          {!collapsed && <Link to="/admin-overview" className="font-display text-xl font-bold text-primary">Fin3a <span className="text-sm font-medium text-muted-foreground">Admin</span></Link>}
          <Button variant="ghost" size="icon" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <nav aria-label="Administration" className="mt-6 flex flex-wrap gap-2 lg:flex-col">
          <Button asChild variant={section === "overview" ? "secondary" : "ghost"} className="justify-start" title="Overview"><Link to="/admin-overview"><LayoutDashboard />{!collapsed && "Overview"}</Link></Button>
          <Button asChild variant={section === "ai" ? "secondary" : "ghost"} className="justify-start" title="AI usage"><Link to="/admin"><ChartNoAxesCombined />{!collapsed && "AI usage"}</Link></Button>
          <Button asChild variant={section === "revenue" ? "secondary" : "ghost"} className="justify-start" title="Revenue and fees"><Link to="/admin-revenue"><ChartNoAxesCombined />{!collapsed && "Revenue & fees"}</Link></Button>
        </nav>
        <div className="mt-6 border-t border-border pt-4">
          <Button asChild variant="ghost" className="justify-start" title="Back to Fin3a"><Link to="/dashboard"><ArrowLeft />{!collapsed && "Back to Fin3a"}</Link></Button>
          {!collapsed && <p className="mt-4 flex items-center gap-2 px-3 text-xs text-muted-foreground"><Shield className="size-4 shrink-0" />Restricted administration</p>}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-6xl">{children}</div></main>
    </div>
  );
}