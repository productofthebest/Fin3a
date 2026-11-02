// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractDocumentWithOpenAI } from "../lib/document-openai.server";

const input = {
  apiKey: "test-only-key", buffer: new Uint8Array([1, 2, 3]).buffer,
  mimeType: "image/png", filename: "fixture.png", instructions: "Transcribe only.",
};
afterEach(() => vi.unstubAllGlobals());

describe("direct OpenAI document scanning", () => {
  it("uses the direct OpenAI endpoint with server-supplied key and disables storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [
      { content: [{ type: "output_text", text: JSON.stringify({ transactions: [] }) }] },
    ] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await extractDocumentWithOpenAI(input)).toEqual({ transactions: [] });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(request.headers.Authorization).toBe("Bearer test-only-key");
    const body = JSON.parse(request.body);
    expect(body.store).toBe(false);
    expect(body.model).toBe("gpt-5-mini");
    expect(body.input[0].content[0]).toEqual({ type: "input_image", image_url: "data:image/png;base64,AQID", detail: "high" });
  });

  it("sends PDFs as inline input files", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: '{"transactions":[]}' }] }] }));
    vi.stubGlobal("fetch", fetchMock);
    await extractDocumentWithOpenAI({ ...input, mimeType: "application/pdf", filename: "statement.pdf" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input[0].content[0]).toEqual({
      type: "input_file", filename: "statement.pdf", file_data: "data:application/pdf;base64,AQID",
    });
  });

  it("does not silently fall back when the OpenAI key is missing", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(extractDocumentWithOpenAI({ ...input, apiKey: undefined })).rejects.toThrow("OPENAI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, "invalid_api_key", "rejected the saved API key"],
    [429, "insufficient_quota", "insufficient API quota"],
    [429, "rate_limit_exceeded", "rate-limiting"],
    [403, "permission_denied", "permission"],
    [400, "context_length_exceeded", "too large"],
    [402, "payment_required", "insufficient API quota"],
  ])("maps status %s/code %s without exposing raw provider content", async (status, code, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code, message: "sensitive-provider-content" } }, { status: Number(status) })));
    await expect(extractDocumentWithOpenAI(input)).rejects.toThrow(String(message));
  });

  it("rejects incomplete output instead of saving a partial statement", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "incomplete", output: [] })));
    await expect(extractDocumentWithOpenAI(input)).rejects.toThrow("No partial scan was saved");
  });

  it("validates transaction fields before returning them to the scanner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: '{"transactions":[{"amount":"not a number"}]}' }] }] })));
    await expect(extractDocumentWithOpenAI(input)).rejects.toThrow("invalid scan");
  });
});