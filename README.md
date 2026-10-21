# Rootmark

**Verify that you control a domain with a DNS record.**

Rootmark is a focused, full-stack experience for validating domain ownership.

The product is built around one trust rule: **“not proven” is not the same as
“failed.”** It issues a unique TXT challenge, checks public DNS on the server,
and explains exactly what it observed without overstating certainty.

## Project links

- **Live product:** [rootmark.vercel.app](https://rootmark.vercel.app)
- **Video demo:** Pending recording
- **Product and build spec:** [docs/SPEC.md](docs/SPEC.md)
- **Current quality-check status:**
  [![Quality checks][quality-badge]][quality-workflow]

## Key decisions

- Verification requires an exact server-observed DNS token.
- Claim status is separate from the latest DNS observation, so transient failures
  cannot revoke ownership.
- Anonymous claims are isolated by a hashed, secure browser-session identifier.
- DNS outcomes have specific recovery paths rather than a generic failure state.
- The workspace supports multiple searchable claims and removal without implying
  that Rootmark changed public DNS.

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

Without `DATABASE_URL`, development uses an in-memory repository so the complete
interaction can be exercised immediately. It survives browser refreshes and
Next.js module hot reloads while the local server process is running, but is
intentionally not used as production persistence.

For durable local or deployed claims:

```bash
cp .env.example .env.local
# Set DATABASE_URL in .env.local, then apply the migration once using the same URL:
psql 'postgresql://...' -f db/migrations/001_create_domain_claims.sql
psql 'postgresql://...' -f db/migrations/002_add_verification_activity.sql
pnpm dev
```

The application intentionally does not mutate its schema during a user request.
The SQL migration is explicit and must be applied before starting against a new
database. Development falls back to an in-memory repository only when
`DATABASE_URL` is absent; production fails fast instead of silently using
ephemeral storage.

## Quality checks

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## API

- `GET /api/claims` lists claims belonging to the current anonymous session.
- `POST /api/claims` normalizes and creates a claim from `{ "domain": "example.com" }`.
- `DELETE /api/claims/:claimId` removes a claim owned by the current session and otherwise returns `404`.
- `POST /api/claims/:claimId/check` rate-limits, resolves both the expected and
  common duplicated host in parallel, persists the observation, and verifies
  only an exact token.

## Security and trust

- Challenge values use 192 bits from Node’s cryptographic random source.
- Session identifiers are stored in `HttpOnly`, `SameSite=Lax`, production-secure
  cookies and are hashed before persistence.
- Domain input is normalized and validated before the encoded resolver request.
- Resolver failures never revoke or verify a claim.
- Requests for absent or cross-session claims return the same `404` response.
- Anonymous sessions are capped at 25 claims with a concurrency-safe database
  guard.
- Vercel Firewall rate-limits claim API traffic to 30 requests per minute per IP
  before requests reach Next.js or Neon.

## Tradeoffs

- Anonymous sessions are lightweight but are not recoverable across browsers.
- The MVP observes one resolver and does not claim global DNS propagation.
- Verification is durable but is not continuously revalidated or automatically
  revoked.
- The per-claim cooldown, session claim cap, and edge rate limit are pragmatic
  abuse controls rather than a replacement for authenticated workspaces.

[quality-badge]: https://github.com/bmosoane/rootmark/actions/workflows/quality.yml/badge.svg
[quality-workflow]: https://github.com/bmosoane/rootmark/actions/workflows/quality.yml
