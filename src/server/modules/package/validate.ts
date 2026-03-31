const TITLE_MAX = 200;
const DESCRIPTION_MAX = 100_000;
const PRICE_MAX = 99_999_999.99;
const SEAT_LIMIT_MAX = 1_000_000;

export type PackageCreateInput = {
  title: string;
  description: string;
  priceRm: number;
  seatLimit: number;
  travelStartDate: string;
  travelEndDate: string;
  bookingCutoffDate: string;
  isActive: boolean;
};

function parseIsoDateOnly(label: string, value: string): string {
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  const [y, mo, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`${label} is not a valid calendar date.`);
  }
  return s;
}

function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function assertPackageCreateInput(raw: {
  title: string;
  description: string;
  priceRm: number;
  seatLimit: number;
  travelStartDate: string;
  travelEndDate: string;
  bookingCutoffDate: string;
  isActive: boolean;
}): PackageCreateInput {
  const title = raw.title.trim();
  if (!title) {
    throw new Error("title is required.");
  }
  if (title.length > TITLE_MAX) {
    throw new Error(`title must be at most ${TITLE_MAX} characters.`);
  }

  const description = raw.description.trim();
  if (!description) {
    throw new Error("description (itinerary) is required.");
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new Error(`description must be at most ${DESCRIPTION_MAX} characters.`);
  }

  const priceRm = raw.priceRm;
  if (typeof priceRm !== "number" || Number.isNaN(priceRm) || !Number.isFinite(priceRm)) {
    throw new Error("priceRm must be a finite number.");
  }
  if (priceRm < 0) {
    throw new Error("priceRm must be non-negative.");
  }
  if (priceRm > PRICE_MAX) {
    throw new Error("priceRm exceeds maximum allowed.");
  }

  if (typeof raw.seatLimit !== "number" || !Number.isFinite(raw.seatLimit)) {
    throw new Error("seatLimit must be a finite number.");
  }
  const seatLimit = Math.floor(raw.seatLimit);
  if (seatLimit < 0) {
    throw new Error("seatLimit must be at least 0 (0 = unlimited).");
  }
  if (seatLimit > SEAT_LIMIT_MAX) {
    throw new Error("seatLimit is too large.");
  }

  const travelStartDate = parseIsoDateOnly("travelStartDate", raw.travelStartDate);
  const travelEndDate = parseIsoDateOnly("travelEndDate", raw.travelEndDate);
  if (compareIsoDates(travelEndDate, travelStartDate) < 0) {
    throw new Error("travelEndDate must be on or after travelStartDate.");
  }

  const bookingCutoffDate = parseIsoDateOnly("bookingCutoffDate", raw.bookingCutoffDate);
  if (compareIsoDates(bookingCutoffDate, travelStartDate) > 0) {
    throw new Error(
      "bookingCutoffDate must be on or before the travel start date (last day to book before departure).",
    );
  }

  return {
    title,
    description,
    priceRm: roundMoney(priceRm),
    seatLimit,
    travelStartDate,
    travelEndDate,
    bookingCutoffDate,
    isActive: raw.isActive,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
