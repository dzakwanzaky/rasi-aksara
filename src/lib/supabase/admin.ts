import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Supabase calls this the secret key (sb_secret_...) or, in older projects, the service_role key.
// It can create accounts, so it lives only in Vercel's environment variables and is never sent to the browser.
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const adminConfigured = () => Boolean(secretKey);

export function createAdminClient() {
  return createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
