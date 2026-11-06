import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Flutterwave V3 sends the configured secret hash in the verif-hash header.
 * This is an exact shared-secret comparison, not an HMAC of the request body.
 * Call this before parsing or processing a webhook payload.
 */
export function isValidFlutterwaveWebhookHash(
  receivedHash: string | null | undefined,
  configuredHash: string | undefined,
): boolean {
  if (
    typeof receivedHash !== "string" ||
    typeof configuredHash !== "string" ||
    receivedHash.length === 0 ||
    configuredHash.length === 0 ||
    receivedHash.length > 512 ||
    configuredHash.length > 512
  ) return false;

  // Hash both values first so timingSafeEqual always compares fixed-size buffers.
  const receivedDigest = createHash("sha256").update(receivedHash, "utf8").digest();
  const configuredDigest = createHash("sha256").update(configuredHash, "utf8").digest();
  return timingSafeEqual(receivedDigest, configuredDigest);
}

export function hasValidFlutterwaveWebhookHash(
  request: Request,
  configuredHash: string | undefined,
): boolean {
  return isValidFlutterwaveWebhookHash(request.headers.get("verif-hash"), configuredHash);
}
