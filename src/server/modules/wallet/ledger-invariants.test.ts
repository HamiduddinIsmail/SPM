import { describe, expect, it } from "vitest";
import {
  assertSufficientBalance,
  calculateBalance,
} from "./ledger-invariants";

describe("calculateBalance", () => {
  it("returns zero for empty entries", () => {
    expect(calculateBalance([])).toBe(0);
  });

  it("computes signed balance from credit/debit entries", () => {
    const balance = calculateBalance([
      { direction: "credit", amount: 1000 },
      { direction: "debit", amount: 300 },
      { direction: "credit", amount: 200 },
    ]);

    expect(balance).toBe(900);
  });
});

describe("assertSufficientBalance", () => {
  it("passes when balance covers deduction", () => {
    expect(() => assertSufficientBalance(500, 300)).not.toThrow();
  });

  it("throws when deduction is non-positive", () => {
    expect(() => assertSufficientBalance(500, 0)).toThrowError(
      "Deduction must be greater than zero.",
    );
    expect(() => assertSufficientBalance(500, -5)).toThrowError(
      "Deduction must be greater than zero.",
    );
  });

  it("throws when balance is insufficient", () => {
    expect(() => assertSufficientBalance(299, 300)).toThrowError(
      "Insufficient wallet balance.",
    );
  });
});
