import { configProblem } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

// Shown when the app cannot reach Supabase, so setup mistakes are readable instead of a 500.
export default function SetupPage() {
  const problem = configProblem();
  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <header className="top">
        <h1><small>Rasi Aksara</small>Koneksi database</h1>
      </header>
      <div className="panel">
        {problem ? (
          <>
            <p className="error">{problem}</p>
            <p className="help">
              Di Vercel buka Settings → Environment Variables, isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> dari tombol Connect di Supabase, lalu Redeploy.
            </p>
          </>
        ) : (
          <p className="help">
            Pengaturan Supabase sudah terisi tapi server tidak bisa dihubungi. Cek apakah project Supabase aktif dan
            kuncinya benar, lalu <a href="/login">coba masuk lagi</a>.
          </p>
        )}
      </div>
    </main>
  );
}
