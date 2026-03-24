"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Role } from "@/server/core/types";

type DashboardClientProps = {
  role: Role;
  userId: string;
};

export function DashboardClient({ role, userId }: DashboardClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [packageId, setPackageId] = useState("");
  const [bookedByUserId, setBookedByUserId] = useState(userId);
  const [beneficiaryAgentId, setBeneficiaryAgentId] = useState(
    role === "agent" ? userId : "",
  );
  const [newPackageTitle, setNewPackageTitle] = useState("");
  const [newPackagePrice, setNewPackagePrice] = useState("7500");
  const [topupAmount, setTopupAmount] = useState("300");
  const [adminTopupTargetUserId, setAdminTopupTargetUserId] = useState("");
  const [adminTopupAmount, setAdminTopupAmount] = useState("300");
  const [adminTopupReason, setAdminTopupReason] = useState("");
  const [bonusYear, setBonusYear] = useState(String(new Date().getUTCFullYear()));
  const [bonusMonth, setBonusMonth] = useState(String(new Date().getUTCMonth() + 1));
  const [bonusExternalBatchId, setBonusExternalBatchId] = useState("");
  const [individualTargetRm, setIndividualTargetRm] = useState("30000");
  const [groupTargetRm, setGroupTargetRm] = useState("100000");
  const [individualMinSales, setIndividualMinSales] = useState("2");
  const [groupMinPersonalSales, setGroupMinPersonalSales] = useState("2");
  const [individualBonusAmountRm, setIndividualBonusAmountRm] = useState("200");
  const [groupBonusAmountRm, setGroupBonusAmountRm] = useState("300");
  const [manualGlBookingId, setManualGlBookingId] = useState("");
  const [manualGlAgentId, setManualGlAgentId] = useState("");
  const [manualGlReason, setManualGlReason] = useState("");
  const [bookingFilterStatus, setBookingFilterStatus] = useState("");
  const [responseText, setResponseText] = useState("");
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [glAssignments, setGlAssignments] = useState<GlAssignmentRow[]>([]);
  const [walletBalanceRm, setWalletBalanceRm] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canCreateBooking =
    role === "superadmin" || role === "admin" || role === "agent" || role === "customer";
  const canAdminActions = role === "superadmin" || role === "admin";

  useEffect(() => {
    void loadPackages();
    void loadBookings();
    void loadWalletSummary();
    if (canAdminActions) {
      void loadUsers();
      void loadBonuses();
      void loadBonusRules();
      void loadGlAssignments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function postJson(url: string, payload: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return { response, result };
  }

  async function loadPackages() {
    const response = await fetch("/api/packages");
    const result = await response.json();
    if (result.ok && Array.isArray(result.data)) {
      setPackages(result.data);
      if (!packageId && result.data.length > 0) {
        setPackageId(result.data[0].id);
      }
      return;
    }
    setResponseText(JSON.stringify(result, null, 2));
  }

  async function loadBookings(status?: string) {
    const query = new URLSearchParams();
    query.set("limit", "25");
    if (status) query.set("status", status);

    const response = await fetch(`/api/bookings?${query.toString()}`);
    const result = await response.json();
    if (result.ok && Array.isArray(result.data)) {
      setBookings(result.data);
      return;
    }
    setResponseText(JSON.stringify(result, null, 2));
  }

  async function loadWalletSummary() {
    const response = await fetch("/api/wallets/me/summary");
    const result = await response.json();
    if (result.ok) {
      setWalletBalanceRm(result.data?.balanceRm ?? 0);
      return;
    }
    setResponseText(JSON.stringify(result, null, 2));
  }

  async function loadUsers() {
    const response = await fetch("/api/users");
    const result = await response.json();
    if (result.ok && Array.isArray(result.data)) {
      setUsers(result.data);
      return;
    }
    setResponseText(JSON.stringify(result, null, 2));
  }

  async function loadBonuses() {
    const year = Number(bonusYear);
    const month = Number(bonusMonth);
    const query = new URLSearchParams();
    if (Number.isInteger(year)) query.set("year", String(year));
    if (Number.isInteger(month)) query.set("month", String(month));
    query.set("limit", "100");

    const response = await fetch(`/api/bonuses?${query.toString()}`);
    const result = await response.json();
    if (result.ok && Array.isArray(result.data)) {
      setBonuses(result.data);
      return;
    }
    setResponseText(JSON.stringify(result, null, 2));
  }

  async function loadBonusRules() {
    const response = await fetch("/api/bonuses/rules");
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.data)) {
      setResponseText(JSON.stringify(result, null, 2));
      return;
    }

    const byKey = new Map<string, BonusRuleRow>();
    for (const row of result.data as BonusRuleRow[]) {
      byKey.set(row.rule_key, row);
    }

    const individualTarget = byKey.get("individual_target_rm");
    const groupTarget = byKey.get("group_target_rm");
    const individualMin = byKey.get("individual_min_sales");
    const groupMin = byKey.get("group_min_personal_sales");
    const individualBonusAmount = byKey.get("individual_bonus_amount");
    const groupBonusAmount = byKey.get("group_bonus_amount");

    if (individualTarget?.numeric_value != null) {
      setIndividualTargetRm(String(individualTarget.numeric_value));
    }
    if (groupTarget?.numeric_value != null) {
      setGroupTargetRm(String(groupTarget.numeric_value));
    }
    if (individualMin?.int_value != null) {
      setIndividualMinSales(String(individualMin.int_value));
    }
    if (groupMin?.int_value != null) {
      setGroupMinPersonalSales(String(groupMin.int_value));
    }
    if (individualBonusAmount?.numeric_value != null) {
      setIndividualBonusAmountRm(String(individualBonusAmount.numeric_value));
    }
    if (groupBonusAmount?.numeric_value != null) {
      setGroupBonusAmountRm(String(groupBonusAmount.numeric_value));
    }
  }

  async function loadGlAssignments() {
    const response = await fetch("/api/gl/assignments?limit=50");
    const result = await response.json();
    if (result.ok && Array.isArray(result.data)) {
      setGlAssignments(result.data);
      return;
    }
    setResponseText(JSON.stringify(result, null, 2));
  }

  async function handleCreateBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateBooking) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const payload = {
        packageId,
        bookedByUserId,
        beneficiaryAgentId: beneficiaryAgentId.trim() || null,
      };
      const { result } = await postJson("/api/bookings/create-with-deposit", payload);
      setResponseText(JSON.stringify(result, null, 2));
      await Promise.all([loadBookings(bookingFilterStatus), loadWalletSummary()]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdminActions) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const priceRm = Number(newPackagePrice);
      const { result } = await postJson("/api/packages", {
        title: newPackageTitle,
        priceRm,
        isActive: true,
      });
      setResponseText(JSON.stringify(result, null, 2));
      if (result.ok) {
        setNewPackageTitle("");
        setNewPackagePrice("7500");
        await loadPackages();
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleWalletTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResponseText("");

    try {
      const amountRm = Number(topupAmount);
      const { result } = await postJson("/api/wallets/me/topup", { amountRm });
      setResponseText(JSON.stringify(result, null, 2));
      if (result.ok) {
        await loadWalletSummary();
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdminWalletTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdminActions) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const amountRm = Number(adminTopupAmount);
      const { result } = await postJson("/api/wallets/admin/topup", {
        targetUserId: adminTopupTargetUserId,
        amountRm,
        reason: adminTopupReason,
      });
      setResponseText(JSON.stringify(result, null, 2));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCalculateMonthlyBonuses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdminActions) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const year = Number(bonusYear);
      const month = Number(bonusMonth);
      const { result } = await postJson("/api/bonuses/calculate-monthly", {
        year,
        month,
      });
      setResponseText(JSON.stringify(result, null, 2));
      if (result.ok) {
        await loadBonuses();
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveBonusRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdminActions) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const updates = [
        {
          ruleKey: "individual_target_rm",
          numericValue: Number(individualTargetRm),
        },
        {
          ruleKey: "group_target_rm",
          numericValue: Number(groupTargetRm),
        },
        {
          ruleKey: "individual_min_sales",
          intValue: Number(individualMinSales),
        },
        {
          ruleKey: "group_min_personal_sales",
          intValue: Number(groupMinPersonalSales),
        },
        {
          ruleKey: "individual_bonus_amount",
          numericValue: Number(individualBonusAmountRm),
        },
        {
          ruleKey: "group_bonus_amount",
          numericValue: Number(groupBonusAmountRm),
        },
      ];

      for (const update of updates) {
        const response = await fetch("/api/bonuses/rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
        const result = await response.json();
        if (!result.ok) {
          setResponseText(JSON.stringify(result, null, 2));
          return;
        }
      }

      setResponseText(
        JSON.stringify(
          { ok: true, message: "Bonus thresholds updated successfully." },
          null,
          2,
        ),
      );
      await loadBonusRules();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmMonthlyBonuses() {
    if (!canAdminActions) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const year = Number(bonusYear);
      const month = Number(bonusMonth);
      const { result } = await postJson("/api/bonuses/confirm-period", {
        year,
        month,
      });
      setResponseText(JSON.stringify(result, null, 2));
      if (result.ok) {
        await loadBonuses();
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePayMonthlyBonuses() {
    if (!canAdminActions) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const year = Number(bonusYear);
      const month = Number(bonusMonth);
      const { result } = await postJson("/api/bonuses/pay-period", {
        year,
        month,
        externalBatchId: bonusExternalBatchId.trim() || undefined,
      });
      setResponseText(JSON.stringify(result, null, 2));
      if (result.ok) {
        await loadBonuses();
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyBookingById(bookingId: string) {
    if (!canAdminActions || !bookingId.trim()) return;

    setIsLoading(true);
    setResponseText("");
    try {
      const { result } = await postJson("/api/bookings/verify", {
        bookingId: bookingId.trim(),
      });
      setResponseText(JSON.stringify(result, null, 2));
      await loadBookings(bookingFilterStatus);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancelBookingById(bookingId: string) {
    if (!canAdminActions || !bookingId.trim()) return;

    setIsLoading(true);
    setResponseText("");
    try {
      const { result } = await postJson("/api/bookings/cancel", {
        bookingId: bookingId.trim(),
      });
      setResponseText(JSON.stringify(result, null, 2));
      await Promise.all([loadBookings(bookingFilterStatus), loadWalletSummary()]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTraceBookingById(bookingId: string) {
    if (!canAdminActions || !bookingId.trim()) return;

    setIsLoading(true);
    setResponseText("");

    try {
      const response = await fetch(`/api/bookings/${bookingId.trim()}/trace`);
      const result = await response.json();
      setResponseText(JSON.stringify(result, null, 2));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssignGlByBookingId(bookingId: string) {
    if (!canAdminActions || !bookingId.trim()) return;

    setIsLoading(true);
    setResponseText("");
    try {
      const { result } = await postJson("/api/gl/assign", {
        bookingId: bookingId.trim(),
      });
      setResponseText(JSON.stringify(result, null, 2));
      await Promise.all([loadBookings(bookingFilterStatus), loadGlAssignments()]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleManualGlOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdminActions) return;

    setIsLoading(true);
    setResponseText("");
    try {
      const { result } = await postJson("/api/gl/manual-override", {
        bookingId: manualGlBookingId,
        groupLeaderAgentId: manualGlAgentId,
        reason: manualGlReason,
      });
      setResponseText(JSON.stringify(result, null, 2));
      if (result.ok) {
        await Promise.all([loadBookings(bookingFilterStatus), loadGlAssignments()]);
        setManualGlReason("");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleRefreshBookings() {
    setIsLoading(true);
    try {
      await loadBookings(bookingFilterStatus);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Current user</p>
            <p className="font-mono text-xs">{userId}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Wallet Balance: <strong>RM {walletBalanceRm ?? 0}</strong>
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Sign out
          </button>
        </div>

        <form onSubmit={handleWalletTopup} className="mt-4 flex flex-wrap items-end gap-3">
          <InputField
            label="Top-up amount (RM)"
            value={topupAmount}
            onChange={setTopupAmount}
            placeholder="300"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Top up wallet
          </button>
        </form>
      </section>

      {canAdminActions ? (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Admin wallet top-up</h2>
          <form onSubmit={handleAdminWalletTopup} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Target User</span>
              <select
                value={adminTopupTargetUserId}
                onChange={(event) => setAdminTopupTargetUserId(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name?.trim() || "Unnamed"} ({user.role}) - {user.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <InputField
              label="Amount (RM)"
              value={adminTopupAmount}
              onChange={setAdminTopupAmount}
              placeholder="300"
              required
            />
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Reason</span>
              <input
                value={adminTopupReason}
                onChange={(event) => setAdminTopupReason(event.target.value)}
                placeholder="Example: manual adjustment for offline payment"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              />
            </label>
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Admin Top-up
                </button>
                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  Refresh users
                </button>
              </div>
            </div>
          </form>
        </section>
      ) : null}

      {canAdminActions ? (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Monthly bonuses</h2>
          <form
            onSubmit={handleSaveBonusRules}
            className="mt-4 grid gap-3 rounded-md border border-zinc-200 p-3 md:grid-cols-3 dark:border-zinc-800"
          >
            <InputField
              label="Individual Target (RM)"
              value={individualTargetRm}
              onChange={setIndividualTargetRm}
              placeholder="30000"
              required
            />
            <InputField
              label="Group Target (RM)"
              value={groupTargetRm}
              onChange={setGroupTargetRm}
              placeholder="100000"
              required
            />
            <InputField
              label="Individual Min Sales (count)"
              value={individualMinSales}
              onChange={setIndividualMinSales}
              placeholder="2"
              required
            />
            <InputField
              label="Group Min Personal Sales (count)"
              value={groupMinPersonalSales}
              onChange={setGroupMinPersonalSales}
              placeholder="2"
              required
            />
            <InputField
              label="Individual Bonus Amount (RM)"
              value={individualBonusAmountRm}
              onChange={setIndividualBonusAmountRm}
              placeholder="200"
              required
            />
            <InputField
              label="Group Bonus Amount (RM)"
              value={groupBonusAmountRm}
              onChange={setGroupBonusAmountRm}
              placeholder="300"
              required
            />
            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-black"
              >
                Save bonus thresholds
              </button>
            </div>
          </form>

          <form
            onSubmit={handleCalculateMonthlyBonuses}
            className="mt-4 grid gap-3 md:grid-cols-4"
          >
            <InputField
              label="Year"
              value={bonusYear}
              onChange={setBonusYear}
              placeholder="2026"
              required
            />
            <InputField
              label="Month"
              value={bonusMonth}
              onChange={setBonusMonth}
              placeholder="1-12"
              required
            />
            <InputField
              label="External Batch ID (optional)"
              value={bonusExternalBatchId}
              onChange={setBonusExternalBatchId}
              placeholder="Bank payout reference"
            />
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Calculate bonuses
              </button>
              <button
                type="button"
                onClick={() => void loadBonuses()}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Refresh
              </button>
            </div>
            <div className="md:col-span-4 flex gap-2">
              <button
                type="button"
                onClick={handleConfirmMonthlyBonuses}
                disabled={isLoading}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Confirm pending bonuses
              </button>
              <button
                type="button"
                onClick={handlePayMonthlyBonuses}
                disabled={isLoading}
                className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Mark confirmed as paid
              </button>
            </div>
          </form>

          <div className="mt-4 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Personal</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bonuses.map((bonus) => (
                  <tr key={bonus.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2">{bonus.bonus_type}</td>
                    <td className="px-3 py-2">
                      {bonus.period_year}-{String(bonus.period_month).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{bonus.beneficiary_agent_id}</td>
                    <td className="px-3 py-2">{bonus.personal_sales_count}</td>
                    <td className="px-3 py-2">{bonus.group_sales_count}</td>
                    <td className="px-3 py-2">RM {Number(bonus.amount_rm)}</td>
                    <td className="px-3 py-2">{bonus.status}</td>
                  </tr>
                ))}
                {bonuses.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-zinc-500 dark:text-zinc-400" colSpan={7}>
                      No bonuses found for selected period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Packages</h2>
          <button
            onClick={() => void loadPackages()}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Refresh
          </button>
        </div>

        {canAdminActions ? (
          <form onSubmit={handleCreatePackage} className="mt-4 grid gap-3 md:grid-cols-3">
            <InputField
              label="Title"
              value={newPackageTitle}
              onChange={setNewPackageTitle}
              placeholder="Example: Umrah Basic 9D7N"
              required
            />
            <InputField
              label="Price (RM)"
              value={newPackagePrice}
              onChange={setNewPackagePrice}
              placeholder="7500"
              required
            />
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Create Package
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">ID</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{pkg.title}</td>
                  <td className="px-3 py-2">RM {Number(pkg.price_rm)}</td>
                  <td className="px-3 py-2">{pkg.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{pkg.id}</td>
                </tr>
              ))}
              {packages.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-500 dark:text-zinc-400" colSpan={4}>
                    No packages found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canCreateBooking ? (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Create booking with deposit</h2>
          <form onSubmit={handleCreateBooking} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Package</span>
              <select
                value={packageId}
                onChange={(event) => setPackageId(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              >
                <option value="">Select package</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.title} - RM {Number(pkg.price_rm)}
                  </option>
                ))}
              </select>
            </label>
            <InputField
              label="Booked By User ID"
              value={bookedByUserId}
              onChange={setBookedByUserId}
              placeholder="Customer user UUID"
              required
            />
            <InputField
              label="Beneficiary Agent ID (optional)"
              value={beneficiaryAgentId}
              onChange={setBeneficiaryAgentId}
              placeholder="Agent user UUID"
              readOnly={role === "agent"}
            />

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
              >
                {isLoading ? "Processing..." : "Create Booking"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="text-lg font-semibold">Bookings</h2>
          <label className="space-y-2">
            <span className="text-sm font-medium">Filter by status</span>
            <select
              value={bookingFilterStatus}
              onChange={(event) => setBookingFilterStatus(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All</option>
              <option value="deposit_paid">deposit_paid</option>
              <option value="verified">verified</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <button
            onClick={handleRefreshBookings}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Refresh Bookings
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Package</th>
                <th className="px-3 py-2">Deposit</th>
                <th className="px-3 py-2">Booked By</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">GL</th>
                {canAdminActions ? <th className="px-3 py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-3 py-2">{booking.status}</td>
                  <td className="px-3 py-2">{booking.packages?.title ?? "-"}</td>
                  <td className="px-3 py-2">RM {Number(booking.deposit_amount_rm)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{booking.booked_by_user_id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{booking.id}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {booking.group_leader_agent_id ?? "-"}
                  </td>
                  {canAdminActions ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleVerifyBookingById(booking.id);
                          }}
                          disabled={isLoading || booking.status !== "deposit_paid"}
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCancelBookingById(booking.id);
                          }}
                          disabled={isLoading || booking.status === "cancelled"}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleTraceBookingById(booking.id);
                          }}
                          disabled={isLoading}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                        >
                          Trace
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleAssignGlByBookingId(booking.id);
                          }}
                          disabled={isLoading || booking.status === "cancelled"}
                          className="rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Assign GL
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {bookings.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-3 text-zinc-500 dark:text-zinc-400"
                    colSpan={canAdminActions ? 7 : 6}
                  >
                    No bookings found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canAdminActions ? (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">GL assignments</h2>
            <button
              onClick={() => void loadGlAssignments()}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              Refresh
            </button>
          </div>

          <form
            onSubmit={handleManualGlOverride}
            className="mt-4 grid gap-3 rounded-md border border-zinc-200 p-3 md:grid-cols-3 dark:border-zinc-800"
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium">Booking</span>
              <select
                value={manualGlBookingId}
                onChange={(event) => setManualGlBookingId(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              >
                <option value="">Select booking</option>
                {bookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.id.slice(0, 8)} - {booking.status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">GL Agent</span>
              <select
                value={manualGlAgentId}
                onChange={(event) => setManualGlAgentId(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              >
                <option value="">Select agent</option>
                {users
                  .filter((u) => u.role === "agent")
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name?.trim() || "Unnamed"} - {user.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>

            <InputField
              label="Override reason"
              value={manualGlReason}
              onChange={setManualGlReason}
              placeholder="Why this manual override is needed"
              required
            />

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-fuchsia-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Manual GL Override
              </button>
            </div>
          </form>

          <div className="mt-4 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">GL Agent</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Assigned At</th>
                </tr>
              </thead>
              <tbody>
                {glAssignments.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2 font-mono text-xs">{row.booking_id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.group_leader_agent_id}</td>
                    <td className="px-3 py-2">{row.assignment_type}</td>
                    <td className="px-3 py-2">{row.assignment_reason}</td>
                    <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {glAssignments.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-zinc-500 dark:text-zinc-400" colSpan={5}>
                      No GL assignments yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">API response</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
          {responseText || "No response yet."}
        </pre>
      </section>
    </div>
  );
}

type PackageRow = {
  id: string;
  title: string;
  price_rm: number;
  is_active: boolean;
};

type BookingRow = {
  id: string;
  status: string;
  booked_by_user_id: string;
  deposit_amount_rm: number;
  group_leader_agent_id: string | null;
  packages?: {
    title?: string;
  } | null;
};

type UserRow = {
  id: string;
  full_name: string | null;
  role: Role;
};

type BonusRow = {
  id: string;
  beneficiary_agent_id: string;
  bonus_type: "individual" | "group";
  period_year: number;
  period_month: number;
  personal_sales_count: number;
  group_sales_count: number;
  amount_rm: number;
  status: "pending" | "confirmed" | "paid" | "cancelled";
};

type BonusRuleRow = {
  rule_key: string;
  int_value: number | null;
  numeric_value: number | null;
};

type GlAssignmentRow = {
  id: string;
  booking_id: string;
  group_leader_agent_id: string;
  assignment_type: "qualified" | "fairness_fallback" | "manual_override";
  assignment_reason: string;
  created_at: string;
};

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
};

function InputField({
  label,
  value,
  onChange,
  placeholder,
  required,
  readOnly,
}: InputFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm read-only:bg-zinc-100 read-only:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:read-only:bg-zinc-800 dark:read-only:text-zinc-300"
        required={required}
      />
    </label>
  );
}
