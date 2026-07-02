# Contributing to Void Ledger

Thank you for your interest in contributing. Void Ledger is a local-first Windows
tool for Warframe Baro planning; keep changes focused and practical.

## Development setup

Requirements:

- Node.js 20 or newer
- npm
- Windows (for PowerShell scripts and AlecaFrame import testing)

```bash
git clone https://github.com/McCal-Codes/void-ledger.git
cd void-ledger
npm install
npm run dev
```

Open `http://127.0.0.1:3000` in your browser.

## Before opening a pull request

Run these checks locally:

```bash
npm run lint
npm run build
```

If you changed live-data, account-import, or startup code, also run the smoke
check with the dev server running:

```bash
npm run smoke -- --base-url http://127.0.0.1:3000
```

## Pull request guidelines

- Keep PRs focused on one change or feature.
- Match existing code style and file organization.
- Do not commit secrets, `.env*` files, or `.void-ledger/` runtime data.
- Update README or API docs when behavior changes.
- Use clear commit messages (e.g. `feat:`, `fix:`, `docs:`, `chore:`).

## Reporting bugs

Use [GitHub Issues](https://github.com/McCal-Codes/void-ledger/issues) and
include:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
- Relevant logs from `.void-ledger/logs` (redact personal paths if needed)

## Security issues

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful
and constructive in all interactions.
