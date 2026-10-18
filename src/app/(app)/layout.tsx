import { createClient } from "@/lib/supabase/server";
import { Nav } from "./Nav";
import Link from "next/link";
import { signOut } from "./actions";
import { accountLabel } from "@/lib/staff";
import { isAdmin } from "@/lib/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const admin = await isAdmin(supabase);
  return (
    <div className="wrap">
      <header className="top">
        <h1><small>Rasi Aksara</small>Operasional</h1>
        <form action={signOut} className="row">
          <span className="muted who">{accountLabel(session?.user.email)}</span>
          {admin && <Link href="/staff" className="btn small">Staff</Link>}
          <button className="btn small">Keluar akun</button>
        </form>
      </header>
      <Nav admin={admin} />
      {children}
    </div>
  );
}
