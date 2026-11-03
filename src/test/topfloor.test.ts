import { describe, expect, it } from "vitest";
import { TOPFLOOR_SITE, extractSameSiteLinks, htmlToText, isCompanyIdentityQuestion } from "@/lib/topfloor";

describe("isCompanyIdentityQuestion", () => {
  it("matches ownership and Top Floor questions", () => {
    expect(isCompanyIdentityQuestion("Who owns Fin3a?")).toBe(true);
    expect(isCompanyIdentityQuestion("Who founded Fin3a?")).toBe(true);
    expect(isCompanyIdentityQuestion("What company is behind Fin3a?")).toBe(true);
    expect(isCompanyIdentityQuestion("Is Fin3a an independent company?")).toBe(true);
    expect(isCompanyIdentityQuestion("What is Fin3a's parent company?")).toBe(true);
    expect(isCompanyIdentityQuestion("What is Top Floor?")).toBe(true);
    expect(isCompanyIdentityQuestion("What does Top Floor do?")).toBe(true);
    expect(isCompanyIdentityQuestion("Tell me about topfloorr.com")).toBe(true);
    expect(isCompanyIdentityQuestion("What other businesses does Top Floor operate?")).toBe(true);
  });

  it("rejects unrelated questions", () => {
    expect(isCompanyIdentityQuestion("What is my balance?")).toBe(false);
    expect(isCompanyIdentityQuestion("How much did I spend last month?")).toBe(false);
    expect(isCompanyIdentityQuestion("What is photosynthesis?")).toBe(false);
    expect(isCompanyIdentityQuestion("")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("strips scripts, styles and tags and decodes entities", () => {
    const html = `<html><head><style>body{color:red}</style></head><body><script>alert(1)</script><h1>Top Floor</h1><p>We build &amp; grow brands&nbsp;fast.</p><!-- comment --></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Top Floor");
    expect(text).toContain("We build & grow brands fast.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("<");
  });
});

describe("extractSameSiteLinks", () => {
  it("keeps only same-origin https page links, deduped, assets excluded", () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://topfloorr.com/services#intro">Services</a>
      <a href="https://topfloorr.com/about">About dup</a>
      <a href="https://other-site.com/page">External</a>
      <a href="http://topfloorr.com/insecure">Insecure</a>
      <a href="/logo.png">Logo</a>
      <a href="mailto:hi@topfloorr.com">Mail</a>`;
    const links = extractSameSiteLinks(html, TOPFLOOR_SITE);
    expect(links).toEqual([
      "https://topfloorr.com/about",
      "https://topfloorr.com/services",
    ]);
  });

  it("returns empty for an invalid site", () => {
    expect(extractSameSiteLinks('<a href="/x">x</a>', "not a url")).toEqual([]);
  });
});
