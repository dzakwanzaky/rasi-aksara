// Supabase's Connect panel now names the public key NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; older projects use ANON_KEY.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
