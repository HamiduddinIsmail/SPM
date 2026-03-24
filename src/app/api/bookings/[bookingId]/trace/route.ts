import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type Params = {
  bookingId: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  try {
    const auth = await requireAuth(["superadmin", "admin"]);
    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { bookingId } = await context.params;
    if (!bookingId) {
      return NextResponse.json(
        { ok: false, message: "bookingId is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();

    const bookingQuery = supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    const statusHistoryQuery = supabase
      .from("booking_status_history")
      .select("*")
      .eq("booking_id", bookingId)
      .order("changed_at", { ascending: true });

    const commissionsQuery = supabase
      .from("commission_records")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    const walletTransactionsQuery = supabase
      .from("wallet_transactions")
      .select("*")
      .eq("reference_type", "booking")
      .eq("reference_id", bookingId)
      .order("created_at", { ascending: true });

    const auditsQuery = supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "booking")
      .eq("entity_id", bookingId)
      .order("created_at", { ascending: true });

    const [bookingRes, statusHistoryRes, commissionsRes, walletTxRes, auditsRes] =
      await Promise.all([
        bookingQuery,
        statusHistoryQuery,
        commissionsQuery,
        walletTransactionsQuery,
        auditsQuery,
      ]);

    if (bookingRes.error) {
      return NextResponse.json(
        {
          ok: false,
          message: bookingRes.error.message,
          code: bookingRes.error.code,
          details: bookingRes.error.details,
        },
        { status: 400 },
      );
    }

    const walletTxIds = (walletTxRes.data ?? []).map((tx) => tx.id);
    let ledgerEntries: unknown[] = [];
    if (walletTxIds.length > 0) {
      const ledgerRes = await supabase
        .from("wallet_ledger_entries")
        .select("*")
        .in("wallet_transaction_id", walletTxIds)
        .order("created_at", { ascending: true });

      if (!ledgerRes.error) {
        ledgerEntries = ledgerRes.data ?? [];
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        booking: bookingRes.data,
        bookingStatusHistory: statusHistoryRes.data ?? [],
        commissions: commissionsRes.data ?? [],
        walletTransactions: walletTxRes.data ?? [],
        walletLedgerEntries: ledgerEntries,
        auditLogs: auditsRes.data ?? [],
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected trace request error.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
