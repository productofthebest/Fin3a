import { describe, expect, it } from "vitest";
import { contactIdentifiers, recipientStorageKey, savedRecipientIds } from "@/lib/contact-recipients";

describe("contact recipients", () => {
  it("uses phone numbers and email, never names for lookup", () => {
    const contact = { name: ["Ada"], tel: [" +2348012345678 "], email: ["ada@example.com"] };
    expect(contactIdentifiers([contact])).toEqual(["+2348012345678", "ada@example.com"]);
    expect(contactIdentifiers([{ name: ["Ada"] } as typeof contact])).toEqual([]);
  });
  it("saves only unique Fin3a identifiers rather than phone numbers or names", () => {
    expect(savedRecipientIds(["FIN-1234ABCD", "FIN-1234ABCD", "Ada", "+2348012345678", "ada@example.com", null])).toEqual(["FIN-1234ABCD"]);
  });
  it("separates saved contacts by account", () => {
    expect(recipientStorageKey("user-one")).not.toBe(recipientStorageKey("user-two"));
  });
});