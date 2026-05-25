# Clarity First Roomier Controls Design

## Summary

Improve Void Ledger's dashboard and planning presentation without adding a new data pipeline. The approved direction makes the high-frequency actions easier to hit, separates source freshness from planning totals, and removes the current ambiguity where the app shows ducats as planned even when the wishlist requires none.

## User Experience

The dashboard becomes the first operational screen:

- A status header reports whether real account data is current and explains the next action when it is stale.
- Planning shows two separate quantities:
  - **Ducats needed for wishlist**: the remaining target after owned/current resources.
  - **Prime parts available if needed later**: convertible ducat capacity that is not treated as an active plan.
- A large **Refresh Sources** control group exposes four explicit user actions:
  - Import Inventory
  - Refresh World
  - Refresh Prices
  - Sync Sheet
- On desktop, actions use four equally sized controls with stable height and clear labels. On narrow screens, controls wrap into two columns and then one column without truncation or overlap.

Settings remains the detailed diagnostics view. Dashboard actions reuse the same safe operations and recovery messaging already established in Settings.

## Planning Semantics

The Balanced Ducat Optimizer is the source of truth for an active conversion plan:

- If wishlist ducat need is `0`, planned conversions are `0` everywhere, including the dashboard and Inventory summary.
- Convertible ducat capacity may remain non-zero and is displayed as available value, not as planned value.
- If a wishlist gap exists, planned conversions contain only the optimizer-selected quantity required to reduce that gap under the existing balanced rules.
- Manually kept parts, protected set quantities, high-value sell recommendations, unknown ducat values, and retry-pending market entries remain excluded from the active conversion plan.

This change does not automatically alter keep decisions, sell parts, spend currency, or update AlecaFrame data.

## Data And Components

- Reuse the existing health endpoint and safe refresh/import endpoints; do not add background refresh behavior.
- Add a shared client-side refresh-source control component so Settings and Dashboard expose the same labels, loading states, success/error feedback, and disabled-state behavior.
- Add a single shared planning summary calculation consumed by the Dashboard and Inventory page so “needed,” “planned,” and “available” cannot diverge between surfaces.
- Keep market prices read-only during ordinary page loads; explicit Refresh Prices remains the only action that mutates the local market cache.

## Visual Rules

- Use full-size icon-and-text action buttons rather than compact abbreviations.
- Keep action controls separated from health cards and numerical planning cards.
- Show stale state as a specific recovery prompt, such as importing inventory again after AlecaFrame produces a newer snapshot.
- Avoid presenting “On Track” because convertible parts exist when there is no wanted item; instead show that no conversion is currently needed.
- Preserve the existing dark operational style, restrained color use, and 8px-or-smaller card radius.

## Failure Handling

- A successful import from a stale AlecaFrame file must still render the source as stale and say that a newer AlecaFrame snapshot is required.
- Refresh actions show progress only for the action invoked and retain the prior valid data until the result is received.
- Market unavailable/no-listing parts remain informational and do not appear as refresh failures.
- When an action fails, display the source-specific recovery message without inserting mock or fallback inventory data.

## Acceptance Criteria

- Dashboard displays large, readable source-action buttons with no clipping or overlap on desktop and mobile widths.
- With the current state of `Wishlist Need = 0`, Dashboard and Inventory both show active planned ducats as `0`, while still exposing available convertible capacity separately.
- With a non-zero wishlist requirement, the active plan total equals only optimizer-selected conversion quantities.
- Dashboard refresh actions produce the same status transitions and messages as Settings.
- Importing an old but real AlecaFrame snapshot does not incorrectly mark account data fresh.
- Page loads do not refresh market prices or modify the market cache.
- No simulated, mock, or demo inventory path is introduced.

## Verification

- Run `npm run lint` and `npm run build`.
- Scan runtime source for mock/simulated fallback paths.
- Verify GET requests for market-aware analysis leave the market cache timestamp unchanged.
- Browser test the Dashboard and Inventory totals for both zero-gap and non-zero-gap scenarios.
- Browser test the four source actions, including the stale-AlecaFrame recovery state.
- Browser test desktop and narrow viewport layouts for button spacing, wrapping, text fit, and console/framework-overlay errors.
