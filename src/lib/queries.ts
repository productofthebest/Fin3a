import { queryOptions } from "@tanstack/react-query";

import { getDashboard, listTransactions } from "./dashboard.functions";
import { listCategories } from "./categories.functions";
import { listBills } from "./bills.functions";
import { getSettings } from "./settings.functions";

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });

export const dashboardQuery = (offset: number) =>
  queryOptions({
    queryKey: ["dashboard", offset],
    queryFn: () => getDashboard({ data: { offset } }),
  });

export const transactionsQuery = (filters: { type?: "income" | "expense"; search?: string } = {}) =>
  queryOptions({
    queryKey: ["transactions", filters.type ?? "all", filters.search ?? ""],
    queryFn: () => listTransactions({ data: filters }),
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
  });

export const billsQuery = () =>
  queryOptions({
    queryKey: ["bills"],
    queryFn: () => listBills(),
  });
