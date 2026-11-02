// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertOwnedDocumentPath, documentUploadInput, MAX_DOCUMENT_BYTES, validateDocumentContent, validateDocumentMetadata } from "@/lib/document-security";

describe("document upload protection", () => {
  it("enforces the existing 15 MB limit at the server input boundary", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(15 * 1024 * 1024);
    const data = { filename: "statement.pdf", mime_type: "application/pdf", storage_path: "owner/file.pdf", size_bytes: MAX_DOCUMENT_BYTES };
    expect(documentUploadInput.safeParse(data).success).toBe(true);
    expect(documentUploadInput.safeParse({ ...data, size_bytes: MAX_DOCUMENT_BYTES + 1 }).success).toBe(false);
  });
  it("rejects cross-account paths and traversal", () => {
    expect(() => assertOwnedDocumentPath("owner/file.pdf", "owner")).not.toThrow();
    for (const path of ["other/file.pdf", "owner/../file.pdf", "owner/", "owner/file\\other.pdf"]) {
      expect(() => assertOwnedDocumentPath(path, "owner")).toThrow();
    }
  });
  it("rejects executable types and contradictory MIME metadata", () => {
    expect(() => validateDocumentMetadata({ filename: "file.html", mime_type: "text/html", size_bytes: 10 })).toThrow();
    expect(() => validateDocumentMetadata({ filename: "file.pdf", mime_type: "image/png", size_bytes: 10 })).toThrow();
    expect(() => validateDocumentMetadata({ filename: "file.csv", mime_type: "", size_bytes: 10 })).not.toThrow();
  });
  it("rejects forged sizes before reading file bytes", async () => {
    const file = new Blob(["%PDF-1.7"]);
    await expect(validateDocumentContent(file, { filename: "file.pdf", mime_type: "application/pdf", size_bytes: 1 })).rejects.toThrow("size is invalid");
  });
  it("rejects disguised HTML before provider submission", async () => {
    const file = new Blob(["<html><script>bad()</script></html>"]);
    await expect(validateDocumentContent(file, { filename: "file.pdf", mime_type: "application/pdf", size_bytes: file.size })).rejects.toThrow("contents");
  });
  it("accepts recognizable PDF and JPEG signatures", async () => {
    for (const [name, mime, file] of [
      ["file.pdf", "application/pdf", new Blob(["%PDF-1.7\n"])],
      ["file.jpg", "image/jpeg", new Blob([new Uint8Array([255, 216, 255, 224])])],
    ] as const) {
      await expect(validateDocumentContent(file, { filename: name, mime_type: mime, size_bytes: file.size })).resolves.toBeUndefined();
    }
  });
});