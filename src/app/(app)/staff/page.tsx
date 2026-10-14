import { createClient } from "@/lib/supabase/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { accountLabel, USERNAME_RULE } from "@/lib/staff";
import { addStaff, resetPassword, setActive, setAdmin } from "./actions";

export const dynamic = "force-dynamic";

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "belum pernah";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: admins } = await supabase.from("app_admins").select("user_id");
  const adminIds = new Set((admins ?? []).map((a) => a.user_id as string));

  if (!session || !adminIds.has(session.user.id)) {
    return (
      <section className="panel">
        <h2>Staff</h2>
        <p className="muted">Halaman ini hanya untuk admin. Minta pemilik kafe untuk membuatkan atau mengubah akun.</p>
      </section>
    );
  }

  if (!adminConfigured()) {
    return (
      <section className="panel">
        <h2>Staff</h2>
        <p>Untuk membuat akun dari sini, pasang dulu kunci rahasia Supabase di Vercel:</p>
        <ol className="steps-list">
          <li>Di Supabase, buka <b>Project Settings</b> lalu <b>API Keys</b>. Salin <b>Secret key</b> (atau <b>service_role</b>).</li>
          <li>Di Vercel, buka project ini, <b>Settings</b> lalu <b>Environment Variables</b>.</li>
          <li>Tambah nama <code>SUPABASE_SECRET_KEY</code>, tempel kuncinya, lalu <b>Save</b>.</li>
          <li>Buka <b>Deployments</b>, klik <b>⋯</b> di deploy paling atas, lalu <b>Redeploy</b>.</li>
        </ol>
        <p className="muted">Kunci ini hanya disimpan di server, tidak pernah dikirim ke HP staff.</p>
      </section>
    );
  }

  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
  const users = (data?.users ?? []).sort((a, b) => accountLabel(a.email).localeCompare(accountLabel(b.email)));
  const now = Date.now();

  return (
    <>
      {ok && <p className="panel notice ok">{ok}</p>}
      {err && <p className="panel notice error">{err}</p>}

      <section className="panel">
        <h2>Tambah staff</h2>
        <p className="muted">Tidak perlu email. Staff masuk pakai username dan kata sandi ini.</p>
        <form action={addStaff} className="staff-form">
          <label className="f">Username<input name="username" required autoCapitalize="none" autoCorrect="off" autoComplete="off" pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,29}" title={USERNAME_RULE} placeholder="mis. budi" /></label>
          <label className="f">Nama (boleh kosong)<input name="name" autoComplete="off" placeholder="mis. Budi Santoso" /></label>
          <label className="f">Kata sandi<input name="password" required minLength={6} autoComplete="new-password" placeholder="minimal 6 karakter" /></label>
          <label className="check"><input type="checkbox" name="is_admin" /> Jadikan admin (boleh mengatur staff)</label>
          <button className="btn primary">Buat akun</button>
        </form>
      </section>

      <section className="panel">
        <h2>Semua akun ({users.length})</h2>
        {error && <p className="error">{error.message}</p>}
        <ul className="staff-list">
          {users.map((u) => {
            // The auth API returns banned_until, but supabase-js does not type it.
            const bannedUntil = (u as { banned_until?: string | null }).banned_until;
            const banned = bannedUntil ? new Date(bannedUntil).getTime() > now : false;
            const isAdmin = adminIds.has(u.id);
            const me = u.id === session.user.id;
            const name = (u.user_metadata?.name as string | undefined) || "";
            return (
              <li key={u.id} className={banned ? "off" : undefined}>
                <div className="staff-head">
                  <b>{accountLabel(u.email)}</b>
                  {name && <span className="muted">{name}</span>}
                  {isAdmin && <span className="unit-tag">admin</span>}
                  {banned && <span className="unit-tag off">nonaktif</span>}
                  {me && <span className="muted">(kamu)</span>}
                </div>
                <p className="muted">Terakhir masuk: {fmt(u.last_sign_in_at)}</p>
                <details>
                  <summary>Atur akun</summary>
                  <form action={resetPassword} className="row">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="password" minLength={6} required placeholder="kata sandi baru" autoComplete="new-password" aria-label="Kata sandi baru" />
                    <button className="btn small">Ganti sandi</button>
                  </form>
                  <div className="row">
                    {!me && (
                      <form action={setActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={banned ? "1" : "0"} />
                        <button className={banned ? "btn small" : "btn small danger"}>{banned ? "Aktifkan lagi" : "Nonaktifkan"}</button>
                      </form>
                    )}
                    {!me && (
                      <form action={setAdmin}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="admin" value={isAdmin ? "0" : "1"} />
                        <button className="btn small">{isAdmin ? "Cabut admin" : "Jadikan admin"}</button>
                      </form>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
