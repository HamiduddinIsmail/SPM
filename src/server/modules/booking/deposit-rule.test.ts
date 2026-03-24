import { describe, expect, it } from "vitest";
import { getDepositAmount } from "./deposit-rule";

describe("getDepositAmount", () => {
  it("returns RM300 for package prices below RM8000", () => {
    expect(getDepositAmount(0)).toBe(300);
    expect(getDepositAmount(7999.99)).toBe(300);
  });

  it("returns RM500 for package prices RM8000 and above", () => {
    expect(getDepositAmount(8000)).toBe(500);
    expect(getDepositAmount(12000)).toBe(500);
  });

  it("throws for negative package prices", () => {
    expect(() => getDepositAmount(-1)).toThrowError(
      "Package price cannot be negative.",
    );
  });
});
