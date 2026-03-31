"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Role } from "@/server/core/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDepositAmount } from "@/server/modules/booking/deposit-rule";

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
  const [newPackageDescription, setNewPackageDescription] = useState("");
  const [newPackagePrice, setNewPackagePrice] = useState("7500");
  const [newPackageSeatLimit, setNewPackageSeatLimit] = useState("30");
  const [newPackageTravelStart, setNewPackageTravelStart] = useState("");
  const [newPackageTravelEnd, setNewPackageTravelEnd] = useState("");
  const [newPackageBookingCutoff, setNewPackageBookingCutoff] = useState("");
  const [newPackageIsActive, setNewPackageIsActive] = useState(true);
  const [packageFormError, setPackageFormError] = useState<string | null>(null);
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
  const [activeSection, setActiveSection] = useState("overview");
  const [tableDensity, setTableDensity] = useState<"compact" | "comfortable">("comfortable");

  const canCreateBooking =
    role === "superadmin" || role === "admin" || role === "agent" || role === "customer";
  const canAdminActions = role === "superadmin" || role === "admin";
  const navItems = useMemo(
    () => [
      { href: "#overview", label: "Overview", icon: "home" as const },
      { href: "#bookings", label: "Bookings", icon: "bookings" as const },
      { href: "#create-booking", label: "Create Booking", icon: "create" as const },
      { href: "#packages", label: "Packages", icon: "packages" as const },
      ...(canAdminActions
        ? [
            { href: "#admin-wallet", label: "Admin Wallet Ops", icon: "wallet" as const },
            { href: "#monthly-bonuses", label: "Monthly Bonuses", icon: "bonus" as const },
            { href: "#gl-assignments", label: "GL Assignments", icon: "leader" as const },
          ]
        : []),
      { href: "#api-response", label: "API Response", icon: "response" as const },
    ],
    [canAdminActions],
  );

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

  useEffect(() => {
    const ids = navItems.map((item) => item.href.replace("#", ""));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.2, 0.4, 0.6] },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [navItems]);

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

    const title = newPackageTitle.trim();
    if (!title) {
      setPackageFormError("Title is required.");
      return;
    }

    setPackageFormError(null);
    setIsLoading(true);
    setResponseText("");

    try {
      const { result } = await postJson("/api/packages", {
        title,
        description: newPackageDescription,
        priceRm: Number(newPackagePrice),
        seatLimit: Number(newPackageSeatLimit),
        travelStartDate: newPackageTravelStart,
        travelEndDate: newPackageTravelEnd,
        bookingCutoffDate: newPackageBookingCutoff,
        isActive: newPackageIsActive,
      });
      setResponseText(JSON.stringify(result, null, 2));
      if (result.ok) {
        setNewPackageTitle("");
        setNewPackageDescription("");
        setNewPackagePrice("7500");
        setNewPackageSeatLimit("30");
        setNewPackageTravelStart("");
        setNewPackageTravelEnd("");
        setNewPackageBookingCutoff("");
        setNewPackageIsActive(true);
        setPackageFormError(null);
        await loadPackages();
      } else if (typeof result.message === "string") {
        setPackageFormError(result.message);
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

  const verifiedBookingsCount = bookings.filter((b) => b.status === "verified").length;
  const pendingBookingsCount = bookings.filter((b) => b.status === "deposit_paid").length;
  const pendingBonusesCount = bonuses.filter((b) => b.status === "pending").length;
  const paidBonusesAmount = bonuses
    .filter((b) => b.status === "paid")
    .reduce((sum, b) => sum + Number(b.amount_rm), 0);
  const cellPadding = tableDensity === "compact" ? "py-1.5" : "py-2.5";
  const headPadding = tableDensity === "compact" ? "py-1.5" : "py-2";
  const bonusYearOptions = useMemo(() => {
    const y = new Date().getUTCFullYear();
    return Array.from({ length: 11 }, (_, i) => String(y - 3 + i));
  }, []);
  const roleDisplay = useMemo(() => {
    if (role === "superadmin") return "Superadmin";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [role]);
  const userInitials = useMemo(() => {
    const id = userId.replace(/-/g, "");
    return (id.slice(0, 2) || "U").toUpperCase();
  }, [userId]);
  const newPackageDepositRm = useMemo(() => {
    const p = Number(newPackagePrice);
    if (!Number.isFinite(p) || p < 0) return null;
    try {
      return getDepositAmount(p);
    } catch {
      return null;
    }
  }, [newPackagePrice]);

  const monthOptions = useMemo(
    () =>
      [
        [1, "January"],
        [2, "February"],
        [3, "March"],
        [4, "April"],
        [5, "May"],
        [6, "June"],
        [7, "July"],
        [8, "August"],
        [9, "September"],
        [10, "October"],
        [11, "November"],
        [12, "December"],
      ] as const,
    [],
  );

  return (
    <>
      {/* Fixed below global theme header (h-12) so it stays on screen while main content scrolls */}
      <aside className="fixed left-0 top-0 z-30 flex h-dvh w-[258px] flex-col overflow-y-auto border-r border-zinc-200/70 bg-white/90 py-6 pl-5 pr-4 shadow-[4px_0_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-[4px_0_24px_rgba(0,0,0,0.35)]">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-2 py-1 no-underline outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#39FF14] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#39FF14] to-lime-400 text-sm font-bold text-zinc-900 shadow-[0_0_20px_rgba(57,255,20,0.45)] ring-2 ring-white/50 dark:ring-zinc-700/50">
            SPM
          </span>
          <div>
            <p className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">SPM</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Travel Agency</p>
          </div>
        </Link>

        <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Workspace">
          {navItems.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={activeSection === item.href.replace("#", "")}
            />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-auto flex shrink-0 items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/60 px-3 py-2.5 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign out
        </button>
      </aside>

      <div className="flex h-dvh min-h-0 w-full flex-1 flex-col bg-zinc-100/95 pl-[258px] dark:bg-zinc-950">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/70 px-5 py-4 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/60 sm:px-8">
          <label className="relative max-w-md flex-1">
            <span className="sr-only">Search</span>
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search…"
              className="w-full rounded-2xl border border-zinc-200/90 bg-white/90 py-2.5 pl-10 pr-4 text-sm text-zinc-900 shadow-sm outline-none ring-[#39FF14]/0 transition placeholder:text-zinc-400 focus:border-[#39FF14]/50 focus:ring-2 focus:ring-[#39FF14]/30 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-100"
              readOnly
            />
          </label>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-xl border border-zinc-300/90 bg-white/90 px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
            <button
              type="button"
              className="relative shrink-0 rounded-xl border border-zinc-200/80 bg-white/80 p-2.5 text-zinc-600 shadow-sm transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="Notifications"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#39FF14] ring-2 ring-white dark:ring-zinc-900" />
            </button>
            <div className="hidden min-w-0 items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:flex">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 text-xs font-bold text-zinc-800 dark:from-zinc-600 dark:to-zinc-700 dark:text-zinc-100">
                {userInitials}
              </span>
              <div className="min-w-0 pr-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">Account</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{roleDisplay}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <main className="mx-auto max-w-6xl space-y-6">
      <section
        id="overview"
        className="rounded-[1.25rem] border border-zinc-200/70 bg-white/90 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Current user</p>
            <p className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{userId}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Wallet balance:{" "}
              <strong className="text-[#39FF14] dark:text-[#39FF14]">RM {walletBalanceRm ?? 0}</strong>
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Table Density</span>
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setTableDensity("comfortable")}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${
                tableDensity === "comfortable"
                  ? "bg-[#39FF14] text-zinc-900 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => setTableDensity("compact")}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${
                tableDensity === "compact"
                  ? "bg-[#39FF14] text-zinc-900 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              Compact
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Bookings (Loaded)" value={String(bookings.length)} />
          <KpiCard label="Pending Verification" value={String(pendingBookingsCount)} />
          <KpiCard label="Verified Bookings" value={String(verifiedBookingsCount)} />
          <KpiCard
            label={canAdminActions ? "Pending Bonuses" : "GL Assignments"}
            value={canAdminActions ? String(pendingBonusesCount) : String(glAssignments.length)}
          />
          <KpiCard
            label={canAdminActions ? "Paid Bonuses (RM)" : "Wallet (RM)"}
            value={canAdminActions ? String(paidBonusesAmount) : String(walletBalanceRm ?? 0)}
          />
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
            className="rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(57,255,20,0.35)] transition hover:bg-[#32e612] disabled:opacity-50"
          >
            Top up wallet
          </button>
        </form>
      </section>

      {canAdminActions ? (
        <section
          id="admin-wallet"
          className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
        >
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
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-50"
                >
                  Admin Top-up
                </button>
                <button
                  type="button"
                  onClick={() => void loadUsers()}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Refresh users
                </button>
              </div>
            </div>
          </form>
        </section>
      ) : null}

      {canAdminActions ? (
        <section
          id="monthly-bonuses"
          className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
        >
          <h2 className="text-lg font-semibold">Monthly bonuses</h2>
          <form
            onSubmit={handleSaveBonusRules}
            className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bonus rule configuration</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-sm font-semibold">Individual bonus rules</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <InputField
                    label="Target (RM)"
                    value={individualTargetRm}
                    onChange={setIndividualTargetRm}
                    placeholder="30000"
                    required
                  />
                  <InputField
                    label="Min Sales (count)"
                    value={individualMinSales}
                    onChange={setIndividualMinSales}
                    placeholder="2"
                    required
                  />
                  <InputField
                    label="Bonus Amount (RM)"
                    value={individualBonusAmountRm}
                    onChange={setIndividualBonusAmountRm}
                    placeholder="200"
                    required
                  />
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-sm font-semibold">Group bonus rules</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <InputField
                    label="Target (RM)"
                    value={groupTargetRm}
                    onChange={setGroupTargetRm}
                    placeholder="100000"
                    required
                  />
                  <InputField
                    label="Min Personal Sales"
                    value={groupMinPersonalSales}
                    onChange={setGroupMinPersonalSales}
                    placeholder="2"
                    required
                  />
                  <InputField
                    label="Bonus Amount (RM)"
                    value={groupBonusAmountRm}
                    onChange={setGroupBonusAmountRm}
                    placeholder="300"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-black"
              >
                Save bonus thresholds
              </button>
            </div>
          </form>

          <form
            onSubmit={handleCalculateMonthlyBonuses}
            className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Monthly operations</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  Year
                </span>
                <select
                  value={bonusYear}
                  onChange={(e) => setBonusYear(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                  required
                  aria-describedby="bonus-year-hint"
                >
                  {bonusYearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <p id="bonus-year-hint" className="text-xs text-zinc-500 dark:text-zinc-400">
                  Calendar year for the bonus period (UTC).
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  Month
                </span>
                <select
                  value={bonusMonth}
                  onChange={(e) => setBonusMonth(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                  required
                  aria-describedby="bonus-month-hint"
                >
                  {monthOptions.map(([num, name]) => (
                    <option key={num} value={String(num)}>
                      {String(num).padStart(2, "0")} — {name}
                    </option>
                  ))}
                </select>
                <p id="bonus-month-hint" className="text-xs text-zinc-500 dark:text-zinc-400">
                  Month 1–12 (January–December). Used with Year to load and calculate bonuses.
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  External Batch ID (optional)
                </span>
                <input
                  value={bonusExternalBatchId}
                  onChange={(e) => setBonusExternalBatchId(e.target.value)}
                  placeholder="Bank payout reference"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                  aria-describedby="bonus-batch-hint"
                />
                <p id="bonus-batch-hint" className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tie payouts to a bank or finance batch ID for auditing (optional).
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Workflow</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold leading-snug text-white shadow-sm transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Calculate bonuses
                </button>
                <button
                  type="button"
                  onClick={() => void loadBonuses()}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center text-sm font-semibold leading-snug text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Refresh list
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMonthlyBonuses}
                  disabled={isLoading}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold leading-snug text-white shadow-sm transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Confirm pending bonuses
                </button>
                <button
                  type="button"
                  onClick={handlePayMonthlyBonuses}
                  disabled={isLoading}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold leading-snug text-white shadow-sm transition hover:bg-emerald-500 disabled:pointer-events-none disabled:opacity-50"
                >
                  Mark confirmed as paid
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Run calculate → review table → confirm → mark paid. Refresh reloads rows for the year/month above.
              </p>
            </div>
          </form>

          <div className="mt-4 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className={`px-3 ${headPadding}`}>Type</th>
                  <th className={`px-3 ${headPadding}`}>Period</th>
                  <th className={`px-3 ${headPadding}`}>Agent</th>
                  <th className={`px-3 ${headPadding}`}>Personal</th>
                  <th className={`px-3 ${headPadding}`}>Group</th>
                  <th className={`px-3 ${headPadding}`}>Amount</th>
                  <th className={`px-3 ${headPadding}`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bonuses.map((bonus) => (
                  <tr key={bonus.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className={`px-3 ${cellPadding}`}>{bonus.bonus_type}</td>
                    <td className={`px-3 ${cellPadding}`}>
                      {bonus.period_year}-{String(bonus.period_month).padStart(2, "0")}
                    </td>
                    <td className={`px-3 ${cellPadding} font-mono text-xs`}>{bonus.beneficiary_agent_id}</td>
                    <td className={`px-3 ${cellPadding}`}>{bonus.personal_sales_count}</td>
                    <td className={`px-3 ${cellPadding}`}>{bonus.group_sales_count}</td>
                    <td className={`px-3 ${cellPadding}`}>RM {Number(bonus.amount_rm)}</td>
                    <td className={`px-3 ${cellPadding}`}>
                      <BonusStatusPill status={bonus.status} />
                    </td>
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

      <section
        id="packages"
        className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
      >
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
          <form onSubmit={handleCreatePackage} className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InputField
                label="Package title"
                value={newPackageTitle}
                onChange={(v) => {
                  setNewPackageTitle(v);
                  setPackageFormError(null);
                }}
                placeholder="Example: Umrah Basic 9D7N"
                required
              />
              <InputField
                label="Price (RM)"
                value={newPackagePrice}
                onChange={(v) => {
                  setNewPackagePrice(v);
                  setPackageFormError(null);
                }}
                placeholder="7500"
                required
              />
              <InputField
                label="Seat limit (pax)"
                value={newPackageSeatLimit}
                onChange={(v) => {
                  setNewPackageSeatLimit(v);
                  setPackageFormError(null);
                }}
                placeholder="30"
                required
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Seat limit: use <strong>0</strong> for unlimited. Bookings count when status is deposit paid or verified.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  Travel start (go)
                </span>
                <input
                  type="date"
                  value={newPackageTravelStart}
                  onChange={(e) => {
                    setNewPackageTravelStart(e.target.value);
                    setPackageFormError(null);
                  }}
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#39FF14]/70 focus:ring-2 focus:ring-[#39FF14]/25 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-[#39FF14]/60"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  Travel end (back)
                </span>
                <input
                  type="date"
                  value={newPackageTravelEnd}
                  onChange={(e) => {
                    setNewPackageTravelEnd(e.target.value);
                    setPackageFormError(null);
                  }}
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#39FF14]/70 focus:ring-2 focus:ring-[#39FF14]/25 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-[#39FF14]/60"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  Booking deadline
                </span>
                <input
                  type="date"
                  value={newPackageBookingCutoff}
                  onChange={(e) => {
                    setNewPackageBookingCutoff(e.target.value);
                    setPackageFormError(null);
                  }}
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#39FF14]/70 focus:ring-2 focus:ring-[#39FF14]/25 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-[#39FF14]/60"
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Booking deadline is the last day customers can reserve this package (must be on or before travel start).
            </p>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                Description &amp; itinerary
              </span>
              <textarea
                value={newPackageDescription}
                onChange={(e) => {
                  setNewPackageDescription(e.target.value);
                  setPackageFormError(null);
                }}
                placeholder="Paste full itinerary, inclusions, flight notes, hotel list, etc."
                required
                rows={8}
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#39FF14]/70 focus:ring-2 focus:ring-[#39FF14]/25 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-[#39FF14] focus:ring-[#39FF14] dark:border-zinc-600"
                checked={newPackageIsActive}
                onChange={(e) => setNewPackageIsActive(e.target.checked)}
              />
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                List as active (bookable)
              </span>
            </label>
            {newPackageDepositRm != null ? (
              <p className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
                Booking deposit for this price:{" "}
                <strong className="text-zinc-900 dark:text-[#39FF14]">RM {newPackageDepositRm}</strong>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {" "}
                  (RM 300 if price &lt; 8,000; RM 500 if price ≥ 8,000)
                </span>
              </p>
            ) : null}
            {packageFormError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {packageFormError}
              </p>
            ) : null}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-[0_0_16px_rgba(57,255,20,0.35)] transition hover:bg-[#32e612] disabled:opacity-50"
              >
                {isLoading ? "Creating…" : "Create package"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Title</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Itinerary</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Price</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Travel</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Book by</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Seats</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Status</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>ID</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => {
                const limit = Number(pkg.seat_limit ?? 0);
                const taken = Number(pkg.seats_booked ?? 0);
                const seatsLabel =
                  limit > 0 ? `${taken} / ${limit}` : taken > 0 ? `${taken} / ∞` : "∞";
                const travelStart = pkg.travel_start_date ?? "—";
                const travelEnd = pkg.travel_end_date ?? "—";
                const desc = (pkg.description ?? "").trim();
                const descPreview =
                  desc.length > 120 ? `${desc.slice(0, 120)}…` : desc || "—";
                return (
                  <tr key={pkg.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className={`px-3 ${cellPadding} max-w-[10rem] align-top`}>
                      <span className="font-medium">{pkg.title}</span>
                    </td>
                    <td
                      className={`px-3 ${cellPadding} max-w-xs align-top text-xs text-zinc-600 dark:text-zinc-400`}
                      title={desc || undefined}
                    >
                      {descPreview}
                    </td>
                    <td className={`px-3 ${cellPadding} align-top whitespace-nowrap`}>
                      RM {Number(pkg.price_rm)}
                    </td>
                    <td className={`px-3 ${cellPadding} align-top whitespace-nowrap text-xs`}>
                      {travelStart} → {travelEnd}
                    </td>
                    <td className={`px-3 ${cellPadding} align-top whitespace-nowrap text-xs`}>
                      {pkg.booking_cutoff_date ?? "—"}
                    </td>
                    <td className={`px-3 ${cellPadding} align-top whitespace-nowrap text-xs`}>{seatsLabel}</td>
                    <td className={`px-3 ${cellPadding} align-top`}>
                      <StatusPill
                        tone={pkg.is_active ? "success" : "muted"}
                        label={pkg.is_active ? "Active" : "Inactive"}
                      />
                    </td>
                    <td className={`px-3 ${cellPadding} align-top font-mono text-xs`}>{pkg.id}</td>
                  </tr>
                );
              })}
              {packages.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-500 dark:text-zinc-400" colSpan={8}>
                    No packages found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canCreateBooking ? (
        <section
          id="create-booking"
          className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
        >
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
                {packages.map((pkg) => {
                  const limit = Number(pkg.seat_limit ?? 0);
                  const taken = Number(pkg.seats_booked ?? 0);
                  const open =
                    limit <= 0 ? null : Math.max(0, limit - taken);
                  const seatHint =
                    open === null ? "" : open === 0 ? " — full" : ` — ${open} seats left`;
                  return (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.title} — RM {Number(pkg.price_rm)}
                      {pkg.travel_start_date ? ` (${pkg.travel_start_date})` : ""}
                      {seatHint}
                    </option>
                  );
                })}
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
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
              >
                {isLoading ? "Processing..." : "Create Booking"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section
        id="bookings"
        className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
      >
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
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Refresh Bookings
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Status</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Package</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Deposit</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Booked By</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>ID</th>
                <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>GL</th>
                {canAdminActions ? <th className={`px-3 ${headPadding} text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300`}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className={`px-3 ${cellPadding}`}>
                    <StatusPill
                      tone={
                        booking.status === "verified"
                          ? "success"
                          : booking.status === "cancelled"
                            ? "danger"
                            : "warning"
                      }
                      label={booking.status}
                    />
                  </td>
                  <td className={`px-3 ${cellPadding}`}>{booking.packages?.title ?? "-"}</td>
                  <td className={`px-3 ${cellPadding}`}>RM {Number(booking.deposit_amount_rm)}</td>
                  <td className={`px-3 ${cellPadding} font-mono text-xs`}>{booking.booked_by_user_id}</td>
                  <td className={`px-3 ${cellPadding} font-mono text-xs`}>{booking.id}</td>
                  <td className={`px-3 ${cellPadding} font-mono text-xs`}>
                    {booking.group_leader_agent_id ?? "-"}
                  </td>
                  {canAdminActions ? (
                    <td className={`px-3 ${cellPadding}`}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleVerifyBookingById(booking.id);
                          }}
                          disabled={isLoading || booking.status !== "deposit_paid"}
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
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
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
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
                          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
                          className="rounded-md bg-purple-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:opacity-40"
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
        <section
          id="gl-assignments"
          className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
        >
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
                  <th className={`px-3 ${headPadding}`}>Booking</th>
                  <th className={`px-3 ${headPadding}`}>GL Agent</th>
                  <th className={`px-3 ${headPadding}`}>Type</th>
                  <th className={`px-3 ${headPadding}`}>Reason</th>
                  <th className={`px-3 ${headPadding}`}>Assigned At</th>
                </tr>
              </thead>
              <tbody>
                {glAssignments.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className={`px-3 ${cellPadding} font-mono text-xs`}>{row.booking_id}</td>
                    <td className={`px-3 ${cellPadding} font-mono text-xs`}>{row.group_leader_agent_id}</td>
                    <td className={`px-3 ${cellPadding}`}>{row.assignment_type}</td>
                    <td className={`px-3 ${cellPadding}`}>{row.assignment_reason}</td>
                    <td className={`px-3 ${cellPadding}`}>{new Date(row.created_at).toLocaleString()}</td>
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

      <section
        id="api-response"
        className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
      >
        <h2 className="text-lg font-semibold">API response</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
          {responseText || "No response yet."}
        </pre>
      </section>
          </main>
        </div>
      </div>
    </>
  );
}

type PackageRow = {
  id: string;
  title: string;
  description?: string | null;
  price_rm: number;
  is_active: boolean;
  seat_limit?: number | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  booking_cutoff_date?: string | null;
  seats_booked?: number;
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

function BonusStatusPill({ status }: { status: BonusRow["status"] }) {
  const map: Record<BonusRow["status"], { tone: StatusPillTone; label: string }> = {
    pending: { tone: "warning", label: "Pending" },
    confirmed: { tone: "info", label: "Confirmed" },
    paid: { tone: "success", label: "Paid" },
    cancelled: { tone: "danger", label: "Cancelled" },
  };
  const { tone, label } = map[status];
  return <StatusPill tone={tone} label={label} />;
}

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
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#39FF14]/70 focus:ring-2 focus:ring-[#39FF14]/25 read-only:bg-zinc-100 read-only:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-[#39FF14]/60 dark:focus:ring-[#39FF14]/20 dark:read-only:bg-zinc-800 dark:read-only:text-zinc-300"
        required={required}
      />
    </label>
  );
}

type SidebarLinkProps = {
  href: string;
  label: string;
  icon: NavIconName;
  active?: boolean;
};

function SidebarLink({ href, label, icon, active = false }: SidebarLinkProps) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-[#39FF14] text-zinc-900 shadow-[0_0_22px_rgba(57,255,20,0.4)]"
          : "text-zinc-600 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
      }`}
    >
      <NavIcon name={icon} />
      {label}
    </a>
  );
}

type NavIconName =
  | "home"
  | "bookings"
  | "create"
  | "packages"
  | "wallet"
  | "bonus"
  | "leader"
  | "response";

function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, string> = {
    home: "M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3v-10.5z",
    bookings: "M4 6h16M7 3v6M17 3v6M5 10h14v11H5V10z",
    create: "M12 5v14M5 12h14",
    packages: "M4 7l8-4 8 4-8 4-8-4zm0 4l8 4 8-4m-16 4l8 4 8-4",
    wallet: "M3 8h18v10H3V8zm14 4h3",
    bonus: "M12 3l3 6 6 .9-4.5 4.4 1.1 6.2L12 17l-5.6 3.5 1.1-6.2L3 9.9 9 9l3-6z",
    leader: "M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.3L12 15l-4.6 2.5.9-5.3-3.8-3.7 5.2-.8L12 3zm-6 16h12v2H6v-2z",
    response: "M4 4h16v12H7l-3 3V4z",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

type StatusPillTone = "success" | "warning" | "danger" | "muted" | "info";

type StatusPillProps = {
  label: string;
  tone: StatusPillTone;
};

function StatusPill({ label, tone }: StatusPillProps) {
  const toneClass: Record<StatusPillTone, string> = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    danger:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    muted:
      "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
    info:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass[tone]}`}>
      {label}
    </span>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
};

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_6px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1.5 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}
