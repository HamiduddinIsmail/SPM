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

describe("POST /api/wallets/admin/topup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized callers", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      errorResponse: Response.json({ ok: false, message: "Forbidden." }, { status: 403 }),
    });

    const req = new Request("http://localhost/api/wallets/admin/topup", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "agent-1",
        amountRm: 100,
        reason: "manual adjustment",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("validates request body and rejects invalid amount", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      context: { userId: "admin-1", role: "admin" },
    });

    const req = new Request("http://localhost/api/wallets/admin/topup", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "agent-1",
        amountRm: 0,
        reason: "manual adjustment",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toContain("amountRm");
  });

  it("returns success when RPC top-up succeeds", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      context: { userId: "admin-1", role: "admin" },
    });
    mockRpc.mockResolvedValue({
      data: { amount_rm: 300, target_user_id: "agent-1" },
      error: null,
    });

    const req = new Request("http://localhost/api/wallets/admin/topup", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "agent-1",
        amountRm: 300,
        reason: "manual adjustment",
        idempotencyKey: "idemp-1",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.amount_rm).toBe(300);
    expect(mockRpc).toHaveBeenCalledWith("admin_topup_wallet_for_user", {
      p_owner_user_id: "agent-1",
      p_actor_user_id: "admin-1",
      p_amount_rm: 300,
      p_reason: "manual adjustment",
      p_idempotency_key: "idemp-1",
    });
  });
});
