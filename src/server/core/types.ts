export type Role = "superadmin" | "admin" | "agent" | "customer";

export type BookingStatus =
  | "draft"
  | "deposit_pending"
  | "deposit_paid"
  | "verified"
  | "cancelled";

export type CommissionStatus = "pending" | "confirmed" | "paid" | "cancelled";

export type WalletTransactionType = "topup" | "deduct" | "refund" | "adjustment";
