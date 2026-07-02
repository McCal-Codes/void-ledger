"use client";

import Link from "next/link";
import { Database, FileJson, ListChecks, Settings } from "lucide-react";

type PortableSetupPanelProps = {
  compact?: boolean;
};

const SETUP_ITEMS = [
  {
    title: "Plan manually",
    description: "Wishlist, resource settings, Baro data, fissures, and market checks work before any account import.",
    icon: ListChecks,
  },
  {
    title: "Import AlecaFrame",
    description: "Void Ledger reads this Windows user's local AlecaFrame lastData.dat and saves its own snapshot.",
    icon: Database,
  },
  {
    title: "Move by backup",
    description: "JSON Backup carries settings, wishlist, catalog rows, and account snapshot to another local copy.",
    icon: FileJson,
  },
];

export function PortableSetupPanel({ compact = false }: PortableSetupPanelProps) {
  return (
    <section className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">Portable Local Mode</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-cyan-100/80">
            This copy is private to the Windows user running it. Browser planning state stays in
            this browser, and imported account data stays in this app folder.
          </p>
        </div>
        <Link
          href="/settings#account"
          className="inline-flex min-h-10 items-center justify-center rounded border border-cyan-400/50 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
        >
          Open Import Settings
        </Link>
      </div>

      {!compact && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {SETUP_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded border border-cyan-500/15 bg-black/20 p-4">
                <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                <h4 className="mt-3 text-sm font-semibold text-white">{item.title}</h4>
                <p className="mt-1 text-sm text-cyan-100/70">{item.description}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
