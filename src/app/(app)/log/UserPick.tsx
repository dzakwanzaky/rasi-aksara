"use client";

import { useRouter } from "next/navigation";

export function UserPick({ users, current }: { users: string[]; current: string }) {
  const router = useRouter();
  return (
    <label className="f">
      Orang
      <select value={current} onChange={(e) => router.push(e.target.value ? `/log?user=${encodeURIComponent(e.target.value)}` : "/log")}>
        <option value="">Semua</option>
        {users.map((u) => <option key={u} value={u}>{u === "admin" ? "Admin (Supabase)" : u.split("@")[0]}</option>)}
      </select>
    </label>
  );
}
