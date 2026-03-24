import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockRpc } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/server/auth/require-role", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

import { POST } from "./route";

describe("POST /api/bookings/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error response when user is not authorized", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      errorResponse: Response.json({ ok: false, message: "Unauthorized." }, { status: 401 }),
    });

    const req = new Request("http://localhost/api/bookings/verify", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns success payload when RPC succeeds", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      context: { userId: "admin-1", role: "admin" },
    });
    mockRpc.mockResolvedValue({
      data: { booking_id: "booking-1", confirmed_commissions: 2 },
      error: null,
    });

    const req = new Request("http://localhost/api/bookings/verify", {
      method: "POST",
      body: JSON.stringify({ bookingId: "booking-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.booking_id).toBe("booking-1");
    expect(mockRpc).toHaveBeenCalledWith("verify_booking_and_confirm_commissions", {
      p_booking_id: "booking-1",
      p_actor_user_id: "admin-1",
    });
  });

  it("returns 400 when RPC returns error", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      context: { userId: "admin-1", role: "admin" },
    });
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "BOOKING_NOT_FOUND", code: "P0001", details: null },
    });

    const req = new Request("http://localhost/api/bookings/verify", {
      method: "POST",
      body: JSON.stringify({ bookingId: "missing-booking" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toBe("BOOKING_NOT_FOUND");
  });
});
