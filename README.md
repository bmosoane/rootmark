# Rootmark

**Put domain ownership on record.**

Rootmark is a focused, full-stack experience for validating domain ownership.

The product is built around one trust rule: **“not proven” is not the same as “failed.”** It issues a unique TXT challenge, checks public DNS on the server, and explains exactly what it observed without overstating certainty.

## Product decisions

- One ownership method, done well: a scoped DNS TXT challenge.
- Only an exact server-observed token changes a claim to `verified`.
- Check outcomes are modeled separately from claim status.
- `not_found`, `wrong_value`, `wrong_host`, `lookup_failed`, `rate_limited`, and `already_claimed` have different recovery paths.
- Claims are isolated by an opaque `HttpOnly` session cookie. Requests for another session’s claim return `404`.
- Domains live in a searchable workspace index rather than a one-off setup flow, so adding a claim never hides existing domains.
- Each domain detail explains why the TXT challenge proves control, what the verifier observed, and which data crosses the resolver boundary.
- A partial unique index makes the first verified claim for a domain authoritative without revealing its owner.
- The app says “we cannot see it yet,” not “DNS is propagating,” because a single resolver cannot prove propagation.

The complete product, UX, state, architecture, and acceptance spec is in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## Stack

- Next.js 16 App Router and React 19
- TypeScript
- Vercel for frontend and backend deployment
- Neon serverless Postgres
- Cloudflare DNS-over-HTTPS as a read-only public DNS resolver
- Zod at the request boundary
- Vitest for domain and state-model tests

## Run locally

```bash
pnpm install
pnpm dev
```

Without `DATABASE_URL`, development uses an in-memory repository so the complete interaction can be exercised immediately. It survives browser refreshes while the local server is running, but is intentionally not used as production persistence.

For durable local or deployed claims:

```bash
DATABASE_URL=postgresql://... pnpm dev
```

The application creates its small `domain_claims` table and indexes on first use. For a larger production system, schema changes would move to versioned migrations and the check cooldown would use a shared rate limiter.

## Quality checks

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm exec next build --webpack
```

`next build` defaults to Turbopack in this Next.js version. In the restricted Codex execution environment its CSS worker cannot bind an internal local port, so the verified production build command above selects webpack explicitly. The application also runs under `next dev` with Turbopack.

## API

- `GET /api/claims` lists claims belonging to the current anonymous session.
- `POST /api/claims` normalizes and creates a claim from `{ "domain": "example.com" }`.
- `POST /api/claims/:claimId/check` rate-limits, resolves both the expected and common duplicated host in parallel, persists the observation, and verifies only an exact token.

## Security and trust notes

- Challenge values use 192 bits from Node’s cryptographic random source.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Domain input rejects URLs, credentials, ports, IP addresses, and malformed labels; Unicode domains are converted to ASCII.
- User input is encoded with `URLSearchParams` before a DNS request.
- Resolver failures never revoke or verify a claim.
- Existing claim ownership is never disclosed.

## Known limits and production extensions

- Anonymous sessions keep the initial experience lightweight but are not recoverable across browsers; production should use authenticated workspaces.
- The MVP checks one resolver. Multi-resolver observations could support evidence-backed propagation messaging.
- Verification is durable but not continuously revalidated. Production could add scheduled rechecks, expiry policy, and an auditable revocation flow.
- A delegated, expiring handoff link would address the common case where an agency or colleague controls DNS.
- The MVP intentionally excludes email authentication records, registrar integrations, and automated ownership transfers.

## Demo outline

1. Add a domain from the workspace and show that existing domains remain searchable and selectable.
2. Explain why the TXT record is harmless, public, and uniquely scoped.
3. Add an intentional wrong value and show observed-versus-expected recovery.
4. Correct the value and complete a real DNS verification.
5. Show the receipt, session isolation, typed outcomes, and deliberate scope tradeoffs.
