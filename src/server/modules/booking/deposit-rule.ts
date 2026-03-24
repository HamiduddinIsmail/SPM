const THRESHOLD = 8000;
const SMALL_DEPOSIT = 300;
const LARGE_DEPOSIT = 500;

export function getDepositAmount(packagePriceRm: number): number {
  if (packagePriceRm < 0) {
    throw new Error("Package price cannot be negative.");
  }

  return packagePriceRm < THRESHOLD ? SMALL_DEPOSIT : LARGE_DEPOSIT;
}
