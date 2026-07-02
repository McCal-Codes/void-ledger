"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AlecaFrameAccountPanel } from "@/components/settings/AlecaFrameAccountPanel";
import { BackupPanel } from "@/components/settings/BackupPanel";
import { DataHealthPanel } from "@/components/settings/DataHealthPanel";
import { GoogleSheetSyncPanel } from "@/components/settings/GoogleSheetSyncPanel";
import { OverwolfBridgePanel } from "@/components/settings/OverwolfBridgePanel";
import { PortableSetupPanel } from "@/components/onboarding/PortableSetupPanel";
import { fetchJson } from "@/lib/http/json";
import { useStore } from "@/lib/store/useStore";
import {
  Activity,
  CalendarClock,
  Coins,
  CreditCard,
  Database,
  DownloadCloud,
  Link2,
  PackageCheck,
  RefreshCw,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import type { AccountInventoryStatus } from "@/types/account";
import type { Settings } from "@/types/settings";

type NumberSettingKey =
  | "currentDucats"
  | "currentCredits"
  | "averageMinutesPerRun"
  | "expectedDucatsPerRun"
  | "hoursAvailablePerDay"
  | "sellThreshold"
  | "burnThreshold"
  | "platToDucatConversion"
  | "undercutBuffer";

type NumberFieldProps = {
  id: string;
  label: string;
  value: number;
  min?: number;
  step?: number;
  note?: string;
  onChange: (value: string) => void;
};

const INPUT_CLASS =
  "w-full rounded border border-zinc-700 bg-black px-3 py-2 text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500";

function safeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function parseDateTimeLocal(value: string, fallback: Date) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

async function fetchCurrentAccountStatus() {
  return fetchJson<AccountInventoryStatus>("/api/overwolf/inventory?limit=0", { cache: "no-store" }, {
    errorMessage: "Account snapshot refresh failed.",
    emptyMessage: "Account snapshot response was empty.",
    invalidMessage: "Account snapshot response was not valid JSON.",
  });
}

function NumberField({ id, label, value, min = 0, step = 1, note, onChange }: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT_CLASS} mt-2`}
        aria-describedby={note ? `${id}-note` : undefined}
      />
      {note && (
        <p id={`${id}-note`} className="mt-1 text-xs text-zinc-500">
          {note}
        </p>
      )}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-5 flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function SettingsGroup({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-zinc-800 pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-cyan-300">{eyebrow}</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded border border-transparent px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
    >
      <span className="text-zinc-500">{icon}</span>
      {label}
    </a>
  );
}

function SnapshotValue({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="border-l border-zinc-800 pl-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function AccountSnapshotSummary({
  status,
  onSyncResources,
}: {
  status: AccountInventoryStatus;
  onSyncResources: () => void;
}) {
  const hasLiveSnapshot = Boolean(status.hasSnapshot && !status.isSimulated);
  const statusLabel = hasLiveSnapshot ? "Live" : status.isSimulated ? "Ignored" : "Waiting";

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 text-cyan-300" aria-hidden="true" />
          <div>
            <h3 className="text-lg font-semibold text-white">Account Snapshot</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-300">
                {status.source ?? statusLabel}
              </span>
              {hasLiveSnapshot && (
                <span className="rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-300">
                  Real inventory
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onSyncResources}
          disabled={!hasLiveSnapshot}
          className="inline-flex items-center justify-center gap-2 rounded border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Sync Resources
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
        <SnapshotValue label="Items" value={formatNumber(status.summary?.uniqueItemCount)} />
        <SnapshotValue label="Relics" value={formatNumber(status.summary?.relicCount)} tone="text-blue-300" />
        <SnapshotValue label="Prime Parts" value={formatNumber(status.summary?.primePartCount)} tone="text-yellow-300" />
        <SnapshotValue label="Credits" value={formatNumber(status.resources?.credits)} />
        <SnapshotValue label="Ducats" value={formatNumber(status.resources?.ducats)} tone="text-yellow-300" />
        <SnapshotValue label="Platinum" value={formatNumber(status.resources?.platinum)} tone="text-cyan-300" />
      </div>
    </section>
  );
}

export default function SettingsClientPage({
  initialAccountStatus,
}: {
  initialAccountStatus: AccountInventoryStatus;
}) {
  const { settings, updateSettings } = useStore();
  const [accountStatus, setAccountStatus] = useState(initialAccountStatus);
  const [accountStatusError, setAccountStatusError] = useState<string | null>(null);

  const refreshAccountStatus = useCallback(async () => {
    try {
      const nextStatus = await fetchCurrentAccountStatus();
      setAccountStatus(nextStatus);
      setAccountStatusError(null);
    } catch (error) {
      setAccountStatusError(
        error instanceof Error ? error.message : "Unable to refresh account snapshot."
      );
    }
  }, []);

  const updateNumberSetting = (key: NumberSettingKey, value: string) => {
    updateSettings({ [key]: safeNumber(value) } as Partial<Settings>);
  };

  const syncAccountResources = () => {
    updateSettings({
      currentCredits: accountStatus.resources?.credits ?? settings.currentCredits,
      currentDucats: accountStatus.resources?.ducats ?? settings.currentDucats,
    });
  };

  return (
    <AppShell activeHref="/settings">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">Settings</h2>
          <p className="text-zinc-400">Account data, resources, and planning thresholds</p>
        </div>

        {!accountStatus.hasSnapshot && (
          <div className="mb-8">
            <PortableSetupPanel compact />
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <nav aria-label="Settings sections" className="space-y-1">
                <MenuLink href="#health" label="Data Health" icon={<Activity className="h-4 w-4" />} />
                <MenuLink href="#account" label="Account" icon={<Database className="h-4 w-4" />} />
                <MenuLink href="#planning" label="Planning" icon={<PackageCheck className="h-4 w-4" />} />
                <MenuLink href="#market" label="Market" icon={<CreditCard className="h-4 w-4" />} />
                <MenuLink href="#schedule" label="Schedule" icon={<CalendarClock className="h-4 w-4" />} />
                <MenuLink href="#integrations" label="Integrations" icon={<Link2 className="h-4 w-4" />} />
                <MenuLink href="#backup" label="Backup" icon={<DownloadCloud className="h-4 w-4" />} />
              </nav>
              <div className="mt-3 border-t border-zinc-800 px-3 pt-3">
                <p className="text-xs text-zinc-500">Selected Source</p>
                <p className="mt-1 text-sm font-semibold text-cyan-200">{settings.accountDataSource}</p>
              </div>
            </div>
          </aside>

          <div className="space-y-10">
            <SettingsGroup id="health" eyebrow="Status" title="Data Health">
              <DataHealthPanel onAccountStatusRefresh={refreshAccountStatus} />
            </SettingsGroup>

            <SettingsGroup id="account" eyebrow="Source" title="Account">
              <div className="space-y-6">
                <AccountSnapshotSummary status={accountStatus} onSyncResources={syncAccountResources} />
                {accountStatusError && (
                  <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {accountStatusError}
                  </p>
                )}
                <AlecaFrameAccountPanel onAccountStatusRefresh={refreshAccountStatus} />
                <OverwolfBridgePanel
                  key={`${accountStatus.receivedAt ?? "waiting"}-${accountStatus.hasSnapshot}-${accountStatus.isSimulated}`}
                  initialStatus={accountStatus}
                  onStatusChange={setAccountStatus}
                />
              </div>
            </SettingsGroup>

            <SettingsGroup id="planning" eyebrow="Planner" title="Resources and Farming">
              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard title="Current Resources" icon={<Coins className="h-5 w-5 text-yellow-300" aria-hidden="true" />}>
                  <NumberField
                    id="currentDucats"
                    label="Current Ducats"
                    value={settings.currentDucats}
                    onChange={(value) => updateNumberSetting("currentDucats", value)}
                  />
                  <NumberField
                    id="currentCredits"
                    label="Current Credits"
                    value={settings.currentCredits}
                    onChange={(value) => updateNumberSetting("currentCredits", value)}
                  />
                </SectionCard>

                <SectionCard
                  title="Farming Assumptions"
                  icon={<PackageCheck className="h-5 w-5 text-green-300" aria-hidden="true" />}
                >
                  <NumberField
                    id="avgMinutes"
                    label="Avg Minutes Per Run"
                    value={settings.averageMinutesPerRun}
                    step={0.5}
                    onChange={(value) => updateNumberSetting("averageMinutesPerRun", value)}
                  />
                  <NumberField
                    id="expectedDucats"
                    label="Expected Ducats Per Run"
                    value={settings.expectedDucatsPerRun}
                    onChange={(value) => updateNumberSetting("expectedDucatsPerRun", value)}
                  />
                  <NumberField
                    id="hoursPerDay"
                    label="Hours Available Per Day"
                    value={settings.hoursAvailablePerDay}
                    step={0.5}
                    onChange={(value) => updateNumberSetting("hoursAvailablePerDay", value)}
                  />
                </SectionCard>
              </div>
            </SettingsGroup>

            <SettingsGroup id="market" eyebrow="Decisions" title="Market Rules">
              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard
                  title="Prime Part Thresholds"
                  icon={<SlidersHorizontal className="h-5 w-5 text-cyan-300" aria-hidden="true" />}
                >
                  <NumberField
                    id="sellThreshold"
                    label="Sell Threshold"
                    value={settings.sellThreshold}
                    step={0.01}
                    note="Plat per ducat ratio for Sell for Platinum."
                    onChange={(value) => updateNumberSetting("sellThreshold", value)}
                  />
                  <NumberField
                    id="burnThreshold"
                    label="Burn Threshold"
                    value={settings.burnThreshold}
                    step={0.01}
                    note="Plat per ducat ratio for Trade for Ducats."
                    onChange={(value) => updateNumberSetting("burnThreshold", value)}
                  />
                  <NumberField
                    id="platConversion"
                    label="Plat to Ducat Conversion"
                    value={settings.platToDucatConversion}
                    onChange={(value) => updateNumberSetting("platToDucatConversion", value)}
                  />
                </SectionCard>

                <SectionCard
                  title="Trade Display"
                  icon={<WalletCards className="h-5 w-5 text-blue-300" aria-hidden="true" />}
                >
                  <NumberField
                    id="undercutBuffer"
                    label="Undercut Buffer"
                    value={settings.undercutBuffer}
                    onChange={(value) => updateNumberSetting("undercutBuffer", value)}
                  />
                </SectionCard>
              </div>
            </SettingsGroup>

            <SettingsGroup id="schedule" eyebrow="Event" title="TennoCon Relay">
              <SectionCard
                title="Relay Dates"
                icon={<CalendarClock className="h-5 w-5 text-blue-300" aria-hidden="true" />}
              >
                <div>
                  <label htmlFor="relayOpen" className="block text-sm font-medium text-zinc-300">
                    Relay Open Date
                  </label>
                  <input
                    id="relayOpen"
                    type="datetime-local"
                    value={formatDateTimeLocal(settings.relayOpenDate)}
                    onChange={(event) =>
                      updateSettings({
                        relayOpenDate: parseDateTimeLocal(event.target.value, settings.relayOpenDate),
                      })
                    }
                    className={`${INPUT_CLASS} mt-2`}
                    aria-label="Relay open date"
                  />
                </div>
                <div>
                  <label htmlFor="relayClose" className="block text-sm font-medium text-zinc-300">
                    Relay Close Date
                  </label>
                  <input
                    id="relayClose"
                    type="datetime-local"
                    value={formatDateTimeLocal(settings.relayCloseDate)}
                    onChange={(event) =>
                      updateSettings({
                        relayCloseDate: parseDateTimeLocal(event.target.value, settings.relayCloseDate),
                      })
                    }
                    className={`${INPUT_CLASS} mt-2`}
                    aria-label="Relay close date"
                  />
                </div>
              </SectionCard>
            </SettingsGroup>

            <SettingsGroup id="integrations" eyebrow="Imports" title="External Lists">
              <GoogleSheetSyncPanel />
            </SettingsGroup>

            <SettingsGroup id="backup" eyebrow="Save" title="Backup and Restore">
              <BackupPanel onAccountStatusRefresh={refreshAccountStatus} />
            </SettingsGroup>
          </div>
        </div>
    </AppShell>
  );
}
