# Void Ledger

[![CI](https://github.com/McCal-Codes/void-ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/McCal-Codes/void-ledger/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

Void Ledger is a local-first Warframe planning app for TennoCon Baro preparation. It combines wishlist planning, live fissures, Baro status, Prime-part ducat decisions, market pricing, and account inventory snapshots from local sources.

Void Ledger is **not** a hosted account service. Each copy runs on your Windows machine, stores planning state in your browser (`localStorage`), and stores imported account snapshots under the local `.void-ledger` folder (gitignored, never uploaded).

## Disclaimer

Void Ledger is a **fan-made tool** and is **not** officially affiliated with Digital Extremes or Warframe. Warframe and related names are trademarks of Digital Extremes Ltd.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/)
- [Zustand](https://zustand.docs.pmnd.rs/) (persisted client state), [Zod](https://zod.dev/) (validation)

## Windows Quick Start

Requirements:

- Windows PowerShell
- Node.js 20 or newer, with npm available
- AlecaFrame installed only if you want real account inventory import

From the Void Ledger folder:

```powershell
scripts\setup-windows.ps1
scripts\start-windows.ps1
```

`setup-windows.ps1` installs dependencies and builds the app. `start-windows.ps1` starts Void Ledger on `http://127.0.0.1:3000`, opens your browser, and writes server logs to `.void-ledger\logs`.

To stop the hidden local server started by the script:

```powershell
scripts\stop-windows.ps1
```

If you only want the developer commands:

```bash
npm install
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

## First Run

Void Ledger works before account import:

1. Open `http://127.0.0.1:3000`.
2. Add wishlist items or sync the Baro compendium.
3. Enter current credits and ducats manually in Settings.
4. Optional: import AlecaFrame account inventory from Settings.
5. Optional: save a JSON Backup from Settings to move this local data to another copy.

## AlecaFrame Import

The primary real-account flow is local AlecaFrame import:

1. Run Void Ledger from your normal Windows user account.
2. Open Warframe with AlecaFrame running.
3. Wait until AlecaFrame has loaded account data.
4. In Void Ledger, open Settings -> Account.
5. Click Check in AlecaFrame Account Data.
6. Click Import Cache when `lastData.dat` is readable.

Void Ledger reads `%LOCALAPPDATA%\AlecaFrame\lastData.dat`, creates its own normalized snapshot, and saves that snapshot in `.void-ledger\overwolf-inventory.json`. It does not modify AlecaFrame, Warframe, or your Warframe account, and it does not read Warframe Market token files.

## Backup and Portability

Use Settings -> Backup and Restore to save a portable JSON backup. The backup can include:

- planning settings
- wishlist
- relic and prime-part planning state
- Baro catalog rows
- the current account snapshot, if imported

Restore the JSON backup in another local Void Ledger copy to move data between machines.

## Packaging a Portable Copy

To create a zip-ready folder for another Windows user:

```powershell
scripts\package-portable.ps1
```

The package excludes `.void-ledger`, `.next`, `node_modules`, local agent/tooling folders, logs, and env files. The receiving user should unzip it, run `scripts\setup-windows.ps1`, then run `scripts\start-windows.ps1`.

## Local Data Sources

- AlecaFrame cache status: `GET /api/alecaframe/status`
- AlecaFrame cache import: `POST /api/alecaframe/import`
- Account snapshot status/restore: `GET/POST/DELETE /api/overwolf/inventory`
- Live world state: `GET /api/world-state`
- Active fissures: `GET /api/fissures`
- Baro status: `GET /api/baro`
- Baro recommendation sheet: `GET /api/baro-compendium`
- Prime-part analysis and market data: `GET /api/prime-parts?market=1`
- Overall health: `GET /api/health`

The Overwolf bridge remains available as an advanced local capture path, but AlecaFrame import is the normal portable-user flow. See [`overwolf-bridge/README.md`](overwolf-bridge/README.md).

## Verification

After changing live-data, account-data, or portable startup code, verify:

```bash
npm run lint
npm run build
npm run smoke -- --base-url http://127.0.0.1:3000
```

Then run the app and check these routes:

- `/`
- `/wishlist`
- `/inventory`
- `/relics`
- `/fissures`
- `/world-state`
- `/settings`
- `/api/health`
- `/api/alecaframe/status`
- `/api/world-state`
- `/api/prime-parts?market=1`

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and PR guidelines.

## Security

Report vulnerabilities responsibly. See [SECURITY.md](SECURITY.md).

## License

Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for third-party attributions.
