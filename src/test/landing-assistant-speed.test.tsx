import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingAssistant } from "@/components/landing-assistant";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/assistant-upload-menu", () => ({ AssistantUploadMenu: () => null }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Homepage question responsiveness", () => {
  it("acknowledges a question before session lookup resolves and retains guest routing", async () => {
    let resolveSession: (value: { data: { session: null } }) => void = () => {};
    mocks.getSession.mockReturnValue(new Promise(resolve => { resolveSession = resolve; }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Service unavailable" }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => {});
    render(<LandingAssistant />);
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: "Explain budgeting" } });
    fireEvent.click(screen.getByRole("button", { name: "Send", exact: true }));
    expect(screen.getByText("Explain budgeting")).toBeInTheDocument();
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await act(async () => resolveSession({ data: { session: null } }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/public/guest-chat", expect.objectContaining({ body: JSON.stringify({ message: "Explain budgeting" }) })));
    await waitFor(() => expect(screen.getByText("Service unavailable")).toBeInTheDocument());
  });
});