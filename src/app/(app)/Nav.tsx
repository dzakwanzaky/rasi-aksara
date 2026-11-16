"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/absen", label: "Absen" },
  { href: "/jadwal", label: "Jadwal" },
  { href: "/checklist", label: "Checklist" },
  { href: "/laporan", label: "Laporan" },
  { href: "/hitung", label: "Hitung" },
  { href: "/belanja", label: "Belanja" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/bahan", label: "Bahan" },
  { href: "/log", label: "Log" },
];

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  // Highlight the tapped tab straight away, before its page has loaded.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  return (
    <nav className="tabs">
      {(admin ? [...TABS, { href: "/omzet", label: "Omzet" }, { href: "/penjualan", label: "Penjualan" }, { href: "/performa", label: "Performa" }] : TABS).map((t) => (
        <Link
          key={t.href}
          href={t.href}
          onClick={() => !path.startsWith(t.href) && setTapped(t.href)}
          className={tapped === t.href ? "pending" : undefined}
          aria-current={(tapped ? tapped === t.href : path.startsWith(t.href)) ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
