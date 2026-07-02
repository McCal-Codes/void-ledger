"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type NavHref = "/" | "/wishlist" | "/relics" | "/fissures" | "/inventory" | "/world-state" | "/settings";

type AppShellProps = {
  activeHref: NavHref;
  children: ReactNode;
  mainAriaBusy?: boolean;
  mainClassName?: string;
};

const NAV_ITEMS: Array<{ href: NavHref; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/relics", label: "Relics" },
  { href: "/fissures", label: "Fissures" },
  { href: "/inventory", label: "Inventory" },
  { href: "/world-state", label: "World" },
  { href: "/settings", label: "Settings" },
];

function navClassName(active: boolean) {
  return active
    ? "font-semibold text-white"
    : "text-zinc-400 transition-colors hover:text-white";
}

export function AppShell({
  activeHref,
  children,
  mainAriaBusy,
  mainClassName = "container mx-auto px-6 py-8",
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-white">Void Ledger</h1>
            <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm sm:justify-end sm:text-base">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className={navClassName(item.href === activeHref)}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className={mainClassName} aria-busy={mainAriaBusy}>
        {children}
      </main>
    </div>
  );
}
