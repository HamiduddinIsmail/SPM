type LedgerEntry = {
  amount: number;
  direction: "credit" | "debit";
};

export function calculateBalance(entries: LedgerEntry[]): number {
  return entries.reduce((total, entry) => {
    const signed = entry.direction === "credit" ? entry.amount : -entry.amount;
    return total + signed;
  }, 0);
}

export function assertSufficientBalance(balance: number, deduction: number): void {
  if (deduction <= 0) {
    throw new Error("Deduction must be greater than zero.");
  }

  if (balance < deduction) {
    throw new Error("Insufficient wallet balance.");
  }
}
