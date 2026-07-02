# Void Ledger Overwolf Bridge

This is a local development companion for pulling Warframe account inventory through
Overwolf's Warframe game-events provider.

Data flow:

1. Overwolf receives Warframe `match_info.inventory` events.
2. This companion forwards the raw inventory payload to:
   `http://127.0.0.1:3000/api/overwolf/inventory`
3. Void Ledger stores the latest snapshot locally under `.void-ledger/`.

Requirements:

- Void Ledger dev server running on port `3000`.
- Overwolf running this folder as a development app.
- Warframe running on PC. Inventory events are only available when Overwolf emits
  the Warframe game-event payload.
- `icon.png`, `icon-gray.png`, and `icon.ico` must stay beside `manifest.json`;
  Overwolf rejects unpacked apps without valid icon paths.

Load it in Overwolf:

1. Open Overwolf settings.
2. Go to About, then Development options.
3. Choose Load unpacked extension.
4. Select the `overwolf-bridge` folder from your Void Ledger checkout.
5. Click the Void Ledger Overwolf Bridge icon in the Overwolf dock.
6. With Warframe running, open a screen that causes account inventory to refresh.

If Overwolf shows `Unauthorized App`, the bridge did not run. Per Overwolf's
development docs, unpacked or unreleased apps require:

- Being logged in to the Overwolf client.
- An Overwolf account whitelisted for unpacked development apps.

The bridge cannot receive live Warframe inventory until Overwolf allows the
unpacked app to load.

Local checks:

```bash
npm run dev
npm run bridge:status
```

This bridge does not read AlecaFrame private files and does not touch
`WFMarketToken.tk`.
