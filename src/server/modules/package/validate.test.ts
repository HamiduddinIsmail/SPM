import { describe, expect, it } from "vitest";
import { assertPackageCreateInput } from "./validate";

const base = {
  title: " Umrah Basic ",
  description: "Day 1: …",
  priceRm: 7500.126,
  seatLimit: 20,
  travelStartDate: "2026-06-01",
  travelEndDate: "2026-06-10",
  bookingCutoffDate: "2026-05-15",
  isActive: true,
};

describe("assertPackageCreateInput", () => {
  it("accepts valid payload", () => {
    const out = assertPackageCreateInput(base);
    expect(out).toEqual({
      title: "Umrah Basic",
      description: "Day 1: …",
      priceRm: 7500.13,
      seatLimit: 20,
      travelStartDate: "2026-06-01",
      travelEndDate: "2026-06-10",
      bookingCutoffDate: "2026-05-15",
      isActive: true,
    });
  });

  it("allows seatLimit 0 as unlimited", () => {
    const out = assertPackageCreateInput({ ...base, seatLimit: 0 });
    expect(out.seatLimit).toBe(0);
  });

  it("rejects empty description", () => {
    expect(() => assertPackageCreateInput({ ...base, description: "  " })).toThrow(
      /itinerary/i,
    );
  });

  it("rejects cutoff after travel start", () => {
    expect(() =>
      assertPackageCreateInput({
        ...base,
        bookingCutoffDate: "2026-06-05",
        travelStartDate: "2026-06-01",
      }),
    ).toThrow(/cutoff/i);
  });

  it("rejects travel end before start", () => {
    expect(() =>
      assertPackageCreateInput({
        ...base,
        travelStartDate: "2026-06-10",
        travelEndDate: "2026-06-01",
      }),
    ).toThrow(/travelEndDate/i);
  });
});
