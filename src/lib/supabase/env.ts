// Supabase's Connect panel now names the public key NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; older projects use ANON_KEY.
// NEXT_PUBLIC_ values are baked in at build time, so a redeploy is needed after changing them in Vercel.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Names what is wrong with the Supabase settings, or null when they look usable. */
export function configProblem(): string | null {
  if (!supabaseUrl) return "NEXT_PUBLIC_SUPABASE_URL belum diisi.";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl))
    return `NEXT_PUBLIC_SUPABASE_URL harus berupa https://xxxx.supabase.co (sekarang: "${supabaseUrl.slice(0, 40)}").`;
  if (!supabaseKey) return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi.";
  return null;
}
