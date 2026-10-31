import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ForecastSimulator } from "@/components/forecast-simulator";
vi.mock("recharts", () => ({ ResponsiveContainer: () => null, LineChart: () => null, Line: () => null, Tooltip: () => null, XAxis: () => null, CartesianGrid: () => null }));
describe("forecast user inputs", () => {
  it("requires a confirmed balance and produces the requested scenario from eligible history", () => {
    render(<ForecastSimulator currency="NGN" history={{ completeMonths: ["2026-07", "2026-08", "2026-09"], income: 500, spending: 700 }} />);
    expect(screen.getByLabelText("Confirmed available balance (NGN)")).toHaveValue(null);
    fireEvent.change(screen.getByLabelText("Confirmed available balance (NGN)"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Monthly income change (+ / −)"), { target: { value: "-100" } });
    fireEvent.change(screen.getByLabelText("Monthly spending change (+ / −)"), { target: { value: "-50" } });
    fireEvent.change(screen.getByLabelText("One-time purchase"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate scenario" }));
    expect(screen.getByText("Runway: 5 months")).toBeInTheDocument();
    expect(screen.getByText("Runway: 3.2 months")).toBeInTheDocument();
  });
});