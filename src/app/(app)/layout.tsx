import { createClient } from "@/lib/supabase/server";
import { Nav } from "./Nav";
import Link from "next/link";
import { signOut } from "./actions";
import { accountLabel } from "@/lib/staff";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: admin } = session
    ? await supabase.from("app_admins").select("user_id").eq("user_id", session.user.id).maybeSingle()
    : { data: null };
  return (
    <div className="wrap">
      <header className="top">
        <h1><small>Rasi Aksara</small>Stok Opname</h1>
        <form action={signOut} className="row">
          <span className="muted who">{accountLabel(session?.user.email)}</span>
          {admin && <Link href="/staff" className="btn small">Staff</Link>}
          <button className="btn small">Keluar akun</button>
        </form>
      </header>
      <Nav />
      {children}
    </div>
  );
}
