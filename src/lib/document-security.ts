import { z } from "zod";

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const formats: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  csv: ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export const documentUploadInput = z.object({
  filename: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().max(120),
  size_bytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES, "File is larger than 15 MB."),
  storage_path: z.string().trim().min(1).max(600),
});

export function validateDocumentMetadata(file: { filename: string; mime_type: string; size_bytes: number }) {
  if (!Number.isInteger(file.size_bytes) || file.size_bytes <= 0 || file.size_bytes > MAX_DOCUMENT_BYTES) {
    throw new Error("Upload a nonempty file no larger than 15 MB.");
  }
  const extension = file.filename.split(".").pop()?.toLowerCase() ?? "";
  const allowed = formats[extension];
  const mime = file.mime_type.toLowerCase();
  if (!allowed || (mime && mime !== "application/octet-stream" && !allowed.includes(mime))) {
    throw new Error("Unsupported file type. Upload a CSV, Excel file, PDF or photo (PNG/JPG/WebP/GIF).");
  }
  return extension;
}

export function assertOwnedDocumentPath(path: string, userId: string) {
  const segments = path.split("/");
  if (segments[0] !== userId || segments.length !== 2 || !segments[1] ||
      segments.some((part) => part === "." || part === "..") || /[\\\x00-\x1f]/.test(path)) {
    throw new Error("The uploaded file does not belong to this account.");
  }
}

/** Check actual bytes before parsing or sending them to a paid provider. */
export async function validateDocumentContent(file: Blob, metadata: { filename: string; mime_type: string; size_bytes: number }) {
  const extension = validateDocumentMetadata(metadata);
  if (file.size !== metadata.size_bytes || file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("The uploaded file size is invalid. Upload it again (maximum 15 MB).");
  }
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const begins = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const ascii = new TextDecoder().decode(bytes);
  const valid = extension === "pdf" ? ascii.startsWith("%PDF-")
    : extension === "png" ? begins(137, 80, 78, 71, 13, 10, 26, 10)
    : extension === "jpg" || extension === "jpeg" ? begins(255, 216, 255)
    : extension === "gif" ? ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")
    : extension === "webp" ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
    : extension === "xlsx" ? begins(80, 75, 3, 4)
    : extension === "xls" ? begins(208, 207, 17, 224, 161, 177, 26, 225)
    : !bytes.includes(0) && !/^\s*<(?:!doctype|html|script|svg)/i.test(ascii);
  if (!valid) throw new Error("The file contents do not match its format. Upload a valid document.");
}