import type { CommissionStatus } from "@/server/core/types";

const ALLOWED_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransitionCommission(
  current: CommissionStatus,
  next: CommissionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}
