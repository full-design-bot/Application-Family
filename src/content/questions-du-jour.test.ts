import { describe, expect, it } from "vitest";
import { QUESTIONS_DU_JOUR, questionForDate } from "./questions-du-jour";

describe("questions du jour", () => {
  it("contient au moins 150 questions uniques", () => {
    expect(QUESTIONS_DU_JOUR.length).toBeGreaterThanOrEqual(150);
    expect(new Set(QUESTIONS_DU_JOUR.map((q) => q.text)).size).toBe(QUESTIONS_DU_JOUR.length);
  });

  it("est déterministe et change chaque jour", () => {
    expect(questionForDate("2026-11-25")).toEqual(questionForDate("2026-11-25"));
    expect(questionForDate("2026-11-25").text).not.toBe(questionForDate("2026-11-26").text);
  });

  it("ne se répète pas avant d'avoir fait le tour", () => {
    const seen = new Set<string>();
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < QUESTIONS_DU_JOUR.length; i++) {
      const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
      seen.add(questionForDate(d).text);
    }
    expect(seen.size).toBe(QUESTIONS_DU_JOUR.length);
  });
});
