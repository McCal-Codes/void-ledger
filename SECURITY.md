# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

If you discover a security issue, please report it responsibly:

1. **Do not** open a public GitHub issue with exploit details.
2. Use [GitHub Private Vulnerability Reporting](https://github.com/McCal-Codes/void-ledger/security/advisories/new) if available, or open a minimal public issue asking for a private contact channel.
3. Include steps to reproduce, affected versions, and impact assessment.

We aim to acknowledge reports within 7 days and provide a fix or mitigation plan
as soon as practical.

## Scope notes

Void Ledger runs locally on your machine. It does not host user accounts or
collect credentials. Sensitive local paths include:

- `%LOCALAPPDATA%\AlecaFrame\` (read-only import)
- `.void-ledger/` (local snapshots and cache — never commit this folder)

Do not include real account snapshots, token files, or `.env` contents in bug
reports or pull requests.
