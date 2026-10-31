import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { addCategory, deleteCategory } from "@/lib/categories.functions";
import { categoriesQuery, settingsQuery } from "@/lib/queries";
import type { Category } from "@/lib/fin3a";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => pageMeta("Categories", "Organize your Fin3a income and spending categories."),
  ssr: false,
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
    await context.queryClient.ensureQueryData(categoriesQuery());
  },
  component: CategoriesPage,
});

function CategoryCard({ kind, categories }: { kind: "income" | "expense"; categories: Category[] }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);

  const addMut = useMutation({
    mutationFn: () =>
      addCategory({ data: { name, kind, icon: icon || (kind === "income" ? "💰" : "💠") } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category added");
      setName("");
      setIcon("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add category"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to delete category";
      toast.error(
        /foreign key|violates/i.test(message)
          ? "This category is used by transactions or bills — move them first."
          : message,
      );
    },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await addMut.mutateAsync();
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl capitalize">{kind}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-3 py-2">
              <span className="text-lg leading-none">{category.icon}</span>
              <span className="flex-1 text-sm">{category.name}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${category.name}`}
                onClick={() => deleteMut.mutate(category.id)}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
          {categories.length === 0 ? (
            <li className="py-2 text-sm text-muted-foreground">No categories yet.</li>
          ) : null}
        </ul>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="Icon"
            className="w-16 text-center"
            maxLength={4}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`New ${kind} category`}
            maxLength={60}
            required
          />
          <Button type="submit" variant="secondary" size="icon" disabled={busy} aria-label="Add category">
            <Plus className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CategoriesPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery());

  return (
    <AppShell>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Group your money so the dashboard tells a clearer story.
        </p>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CategoryCard kind="expense" categories={categories.filter((c) => c.kind === "expense")} />
        <CategoryCard kind="income" categories={categories.filter((c) => c.kind === "income")} />
      </div>
    </AppShell>
  );
}
