import { describe, expect, it } from "vitest";
import { homepageSearchQuestion, PUBLIC_QUESTION_ERROR } from "@/lib/homepage-web";
import { publicSearchQuery } from "@/lib/web-access";

describe("general homepage web questions", () => {
  it("allows nonfinancial public topics", () => {
    for (const topic of ["Who is the current SEC Nigeria chairman?", "What are NASA's latest Moon mission updates?", "Who won the 2026 World Cup?", "Explain photosynthesis", "Best museums to visit in Lagos"]) {
      expect(homepageSearchQuestion(topic)).toEqual({ query: topic });
    }
  });
  it("does not broaden Dashboard query handling", () => {
    expect(publicSearchQuery("Explain photosynthesis")).toBeNull();
  });
  it("rejects credentials and obvious personal identifiers before searching", () => {
    for (const question of ["Search for alice@example.com", "Find account number 1234567890", "My password is example", "My address is 12 Private Street", "I earn 50000; search the best savings account"]) {
      expect(homepageSearchQuestion(question)).toEqual({ query: null, error: PUBLIC_QUESTION_ERROR });
    }
  });
  it("keeps own-record questions out of search", () => {
    expect(homepageSearchQuestion("How much did I spend last month?")).toEqual({ query: null });
    expect(homepageSearchQuestion("What is my balance?")).toEqual({ query: null });
  });
  it("bounds the public question", () => {
    expect(homepageSearchQuestion("x".repeat(2000)).query).toHaveLength(2000);
    expect(homepageSearchQuestion("x".repeat(2001)).error).toBeDefined();
  });
});