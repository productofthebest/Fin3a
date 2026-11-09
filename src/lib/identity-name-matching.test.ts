import { describe, expect, it } from "vitest";
import { legalNamesMatch, normalizeLegalName } from "./identity-name-matching";

describe("identity name matching", () => {
  it("normalizes spacing, case and compatible Unicode forms", () => {
    expect(normalizeLegalName("  Ada   LOVELACE ")).toBe("ada lovelace");
    expect(normalizeLegalName("Ａｄａ Lovelace")).toBe("ada lovelace");
  });
  it("requires an exact full-name match", () => {
    expect(legalNamesMatch("Ada Lovelace", "ADA  LOVELACE")).toBe(true);
    expect(legalNamesMatch("Ada Lovelace", "Ada")).toBe(false);
    expect(legalNamesMatch("Ada Lovelace", "Ada Byron Lovelace")).toBe(false);
    expect(legalNamesMatch("", "Ada Lovelace")).toBe(false);
  });
});
