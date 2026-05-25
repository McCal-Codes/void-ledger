# Clarity First Roomier Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dashboard and Inventory communicate one accurate active ducat plan and provide spacious explicit source refresh controls.

**Architecture:** Extract the Balanced Ducat Optimizer calculation into a shared pure utility consumed by both pages. Extract safe source actions into a reusable client component used by Settings and Dashboard; keep `/api/health` and existing explicit POST endpoints as the only data/action contracts.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, Tailwind CSS, lucide-react.

---

### Task 1: Shared Balanced Planning Calculation

**Files:**
- Create: `src/lib/inventory/ducatOptimizer.ts`
- Modify: `src/components/inventory/DucatOptimizerPanel.tsx`
- Modify: `src/app/inventory/InventoryClientPage.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add a pure shared optimizer result**

Create `buildBalancedDucatPlan(parts, wishlist, currentDucats)` returning:

```ts
export type BalancedDucatPlan = {
  targetDucats: number;
  neededDucats: number;
  plannedDucats: number;
  remainingGap: number;
  availableDucatCapacity: number;
  trades: PlannedDucatTrade[];
  protectedCopies: number;
  estimatedPlatPreserved: number;
  skippedForPricing: number;
};
```

The function must preserve the current selection rules: burn `Trade for Ducats` parts first, use `Gray Zone` only when needed, never include kept/protected/unknown/retry-pending entries, and limit selected quantity to the actual wishlist gap.

- [ ] **Step 2: Make Inventory use the shared result**

Replace the component-local plan calculation with a passed `plan` object from `InventoryClientPage`. Render `plannedDucats` as the active conversion total and add `Available Capacity` to the summary card so a zero-gap state no longer displays an active burn plan.

- [ ] **Step 3: Make Dashboard use the shared result**

Replace `primePartSummary.tradeableDucatValue` as `plannedConversions` with `balancedPlan.plannedDucats`; show `balancedPlan.availableDucatCapacity` separately as `Available Ducats`. The current live state must render planned conversions as `0` while retaining available capacity.

### Task 2: Shared Source Actions And Roomier Dashboard Controls

**Files:**
- Create: `src/components/data/SourceActionControls.tsx`
- Modify: `src/components/settings/DataHealthPanel.tsx`
- Modify: `src/components/dashboard/DataHealthCard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Extract four safe user-triggered actions**

Add a reusable component accepting `onCompleted?: () => Promise<void> | void` and rendering:

```ts
type SourceAction = "Import Inventory" | "Refresh World" | "Refresh Prices" | "Sync Sheet";
```

Each button must invoke only existing explicit endpoints, display its own running/success/error message, and call `onCompleted` after success.

- [ ] **Step 2: Replace compact Settings action duplicates**

Keep Health and Clear Ignored controls in Settings, but render the new four-action component for Import, World, Market, and Sheet behavior so messaging and endpoint use are shared with Dashboard.

- [ ] **Step 3: Add the spacious Dashboard action band**

Render the shared control below the health/planning cards as a full-width `Refresh Sources` section. Use four stable-height buttons in four desktop columns, two tablet columns, and one compact-mobile column, with clear labels matching the approved mockup.

### Task 3: Verification

**Files:**
- Verify: `src/app/page.tsx`
- Verify: `src/app/inventory/InventoryClientPage.tsx`
- Verify: `src/components/settings/DataHealthPanel.tsx`

- [ ] **Step 1: Run static gates**

Run:

```powershell
npm run lint
npm run build
```

Expected: both exit `0`.

- [ ] **Step 2: Run real-data and no-mock checks**

Run:

```powershell
$hits = rg -n "mockData|mock[A-Z]|bridge:simulate|simulate-overwolf|sample data|Sample" src scripts overwolf-bridge package.json package-lock.json 2>$null
```

Expected: no runtime mock/demo source matches.

Verify `GET /api/prime-parts?market=1` leaves `.void-ledger/prime-part-market-prices.json` timestamp unchanged.

- [ ] **Step 3: Browser QA**

Using the in-app Browser, check `/`, `/inventory`, and `/settings#health`:

```text
Wishlist Need = 0 -> Active Planned Ducats = 0
Available Ducats remains visible separately
Four source buttons are large, readable, and explicit
Refresh World or Sync Sheet produces success feedback
No app console error or framework error overlay appears
```

Also test a narrow viewport for button wrapping and text fit.
