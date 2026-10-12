"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hitung", label: "Hitung" },
  { href: "/belanja", label: "Belanja" },
  { href: "/pemakaian", label: "Pemakaian" },
  { href: "/bahan", label: "Bahan" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path.startsWith(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
