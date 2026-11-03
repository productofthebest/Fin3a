import { queryOptions } from "@tanstack/react-query";

import { getDashboard, listTransactions, listTransactionPage } from "./dashboard.functions";
import { listCategories } from "./categories.functions";
import { listBills } from "./bills.functions";
import { getSettings } from "./settings.functions";

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });

export const dashboardQuery = (offset: number, currency?: string) =>
  queryOptions({
    queryKey: ["dashboard", offset, currency ?? "preferred"],
    queryFn: () => getDashboard({ data: { offset, currency } }),
  });

export const transactionsQuery = (filters: { type?: "income" | "expense"; search?: string } = {}) =>
  queryOptions({
    queryKey: ["transactions", filters.type ?? "all", filters.search ?? ""],
    queryFn: () => listTransactions({ data: filters }),
  });

export type HistoryFilters = { page: number; currency?: string; type?: "income" | "expense"; categoryId?: string; from?: string; to?: string; search?: string };
export const transactionPageQuery = (f: HistoryFilters) =>
  queryOptions({
    queryKey: ["transactions", "page", f],
    queryFn: () => listTransactionPage({ data: f }),
    placeholderData: (prev) => prev,
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
