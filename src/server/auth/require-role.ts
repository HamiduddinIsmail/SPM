import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/server/core/types";

export type AuthContext = {
  userId: string;
  role: Role;
};

export async function requireAuth(
  allowedRoles?: Role[],
): Promise<{ ok: true; context: AuthContext } | { ok: false; errorResponse: Response }> {
  const serverClient = await createSupabaseServerClient();
  const { data: userData, error: userError } = await serverClient.auth.getUser();

  if (userError || !userData.user) {
    return {
      ok: false,
      errorResponse: Response.json(
        { ok: false, message: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      errorResponse: Response.json(
        { ok: false, message: "Profile role not found." },
        { status: 403 },
      ),
    };
  }

  const role = profile.role as Role;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return {
      ok: false,
      errorResponse: Response.json(
        { ok: false, message: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId: userData.user.id,
      role,
    },
  };
}
