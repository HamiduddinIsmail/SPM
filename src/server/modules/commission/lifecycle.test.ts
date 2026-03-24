import { describe, expect, it } from "vitest";
import { canTransitionCommission } from "./lifecycle";

describe("canTransitionCommission", () => {
  it("allows pending -> confirmed/cancelled", () => {
    expect(canTransitionCommission("pending", "confirmed")).toBe(true);
    expect(canTransitionCommission("pending", "cancelled")).toBe(true);
  });

  it("allows confirmed -> paid/cancelled", () => {
    expect(canTransitionCommission("confirmed", "paid")).toBe(true);
    expect(canTransitionCommission("confirmed", "cancelled")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionCommission("pending", "paid")).toBe(false);
    expect(canTransitionCommission("paid", "confirmed")).toBe(false);
    expect(canTransitionCommission("cancelled", "pending")).toBe(false);
  });
});
