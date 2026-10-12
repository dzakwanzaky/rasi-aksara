"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) setError("Email atau kata sandi salah. Minta akun ke pemilik kafe jika belum punya.");
    else {
      router.replace("/hitung");
      router.refresh();
    }
  }

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <header className="top">
        <h1><small>Rasi Aksara</small>Masuk</h1>
      </header>
      <form className="panel" onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label className="f">Email<input id="email" name="email" type="email" autoComplete="email" required /></label>
        <label className="f">Kata sandi<input id="password" name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
      </form>
    </main>
  );
}
