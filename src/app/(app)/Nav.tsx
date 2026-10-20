"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
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
  return (
    <nav className="tabs">
      {(admin ? [...TABS, { href: "/penjualan", label: "Penjualan" }, { href: "/performa", label: "Performa" }] : TABS).map((t) => (
        <Link key={t.href} href={t.href} aria-current={path.startsWith(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
