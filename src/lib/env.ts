function requireValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const nextPublicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  supabaseUrl: requireValue(nextPublicSupabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireValue(
    nextPublicSupabaseAnonKey,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appEnv: process.env.APP_ENV ?? "development",
};
