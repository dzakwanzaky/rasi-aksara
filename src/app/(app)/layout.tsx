import { createClient } from "@/lib/supabase/server";
import { Nav } from "./Nav";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="wrap">
      <header className="top">
        <h1><small>Rasi Aksara</small>Stok Opname</h1>
        <form action={signOut} className="row">
          <span className="muted">{user?.email}</span>
          <button className="btn small">Keluar akun</button>
        </form>
      </header>
      <Nav />
      {children}
    </div>
  );
}
