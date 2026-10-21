# Rootmark implementation checklist

Working decision ledger for the take-home build. This is separate from the product
spec so implementation progress does not obscure the product narrative.

Legend:

- [x] Implemented locally
- [ ] Still to do or validate
- **Not in scope** Deliberately excluded

Nothing in this checklist is considered approved for commit until it has been
reviewed in the running product.

## Product direction

- [x] Use the Rootmark name.
- [x] Present verification as part of a multi-domain dashboard rather than a
  disposable one-domain wizard.
- [x] Use a searchable master-detail layout so the domain collection stays visible
  while one domain is configured or diagnosed.
- [x] Keep the selected domain's identity, durable status, timestamp, and actions on
  the page background.
- [x] Keep DNS instructions provider-neutral.
- [x] Preserve the existing verification state model and Cloudflare DNS-over-HTTPS
  resolver.

## Product shell and navigation

- [x] Replace the placeholder `R` with a minimal root/network SVG mark.
- [x] Use the same visual mark for the Next.js SVG favicon.
- [x] Make the Rootmark logo navigate to `/` without adding `#main-content`.
- [x] Provide a separate keyboard-only “Skip to main content” link.
- [x] Keep only the real Domains destination; do not show decorative Overview or
  Activity links.
- [x] Remove the large fake workspace switcher.
- [x] Replace it with a quiet “Private browser session” indicator.
- [x] Remove the “Proof, not DNS hosting” sidebar card.
- [x] Put the trust-boundary explanation beside the verification task instead.
- [x] Keep the desktop sidebar pinned with `position: sticky`.
- [x] Collapse the sidebar to a pinned Rootmark brand bar on smaller screens; hide
  the redundant Domains item when it is the only available destination.

## Loading, empty, and add-domain states

- [x] Replace centered “Loading domains…” copy with a workspace-shaped skeleton.
- [x] Mark the loading region `aria-busy` and expose loading copy only to assistive
  technology.
- [x] Disable skeleton animation when reduced motion is requested.
- [x] Preserve the existing interface during mutations and show local progress
  instead of replacing it with skeletons.
- [x] With no domains, show an explained empty state before showing the form.
- [x] Explain the three-step proof model and DNS trust boundary in that state.
- [x] Open the first-domain form from one clear action and allow Cancel back to the
  empty state.
- [x] Do not show the header Add action during first-run.
- [x] With existing domains, show the header Add action only while the form is
  closed.
- [x] While adding another domain, hide the duplicate header action and show Cancel
  inside the form.
- [x] Show a dedicated no-search-results state with a clear-search action.
- [x] Keep the one-field form uncontrolled and read it with `FormData`.
- [x] Keep server normalization and validation authoritative.
- [x] Focus inline form errors after they render.

## Domain verification workspace

- [x] Use one primary verification card rather than separate competing cards.
- [x] Keep DNS type, host, and value together with individual copy actions.
- [x] Warn users to add a new TXT record and retain existing TXT, SPF, and DKIM
  records.
- [x] Keep “Check DNS record” as the primary pending-state action.
- [x] Keep the instructions visible while a check is running.
- [x] Put proof-model guidance in the focused “How DNS verification works” dialog.
- [x] Explain that Rootmark reads public DNS but cannot change DNS records.
- [x] Show Last check only after a check result exists.
- [x] Render specific recovery guidance for not found, wrong value, wrong host,
  lookup failure, rate limiting, already claimed, and verified outcomes.
- [x] Turn the same primary surface into a verification receipt after success.
- [x] Treat verification as a durable receipt; do not offer rechecking unless
  continuous monitoring and revocation are introduced together.

## Copy behavior

- [x] Remove the broad copy action so delegation does not compete with the primary
  setup workflow.
- [ ] Consider dedicated handoff instructions as a future extension if user
  research validates the need.
- [x] Keep Host and Value copy buttons for direct entry in Cloudflare, Route 53,
  Namecheap, or another provider.
- [x] Display short Copied and Copy failed feedback without replacing the interface.

## Domain removal

- [x] Add `DELETE /api/claims/:claimId`.
- [x] Enforce session ownership in the service and repository layers.
- [x] Return `204` after removal and a privacy-preserving `404` for absent or
  unowned claims.
- [x] Put Remove domain in a small domain actions menu.
- [x] Require confirmation before removal.
- [x] State that removing a Rootmark claim does not remove the public TXT record.
- [x] Select the next available domain after removal.
- [x] Return to first-run after removing the final domain.
- [x] Generate a new token if the domain is claimed again.
- [x] Cover memory, Neon, service, and route deletion behavior with tests.

## Frontend engineering

- [x] Split the previous oversized client component into the application shell,
  add-domain panel, domain list, claim detail, and result renderer.
- [x] Keep state in the smallest component that owns it.
- [x] Keep check and removal failures scoped to the action that produced them.
- [x] Avoid third-party favicon requests that disclose claimed domains.
- [x] Use shared browser-safe API response contracts in route handlers and client
  code.
- [x] Keep Zod at server request boundaries and out of the client bundle.
- [x] Preserve exhaustive rendering for the discriminated verification results.
- [x] Handle request failures, malformed success responses, and clipboard failures.
- [x] Use `useTransition` for non-urgent mutation pending states.
- [x] Avoid React Hook Form for a single uncontrolled field.
- [x] Keep frontend component files below the previous 600-line size problem.

## Documentation completed

- [x] Add the dashboard, master-detail, disclosure, result-state, receipt, and
  browser-session decisions to the product spec's Design rationale.
- [x] Document deletion, empty-state behavior, and current route contracts.
- [x] Document the deletion endpoint and product decision in the README.

## Remaining before submission

- [ ] Review and approve the SVG mark and favicon visually.
- [ ] Complete a visual pass of first-run, add-another, pending, diagnostic,
  verified, search-empty, and removal states.
- [ ] Complete responsive visual checks at desktop, tablet, and mobile widths.
- [ ] Complete keyboard navigation, focus order, disclosure, and screen-reader-name
  checks.
- [ ] Add focused frontend interaction tests where they add confidence, especially
  error responses and destructive confirmation; do not add a testing framework
  solely to inflate coverage.
- [ ] Verify a controlled domain successfully against live public DNS.
- [x] Refresh all product-spec screenshots from the final running product.
- [x] Keep the latest check primary and add a focused, deduplicated
  verification-activity timeline; retain raw attempts only in structured server logs.
- [x] Remove the unused `docs/images/rootmark-dashboard.jpg` after confirming it is
  not needed.
- [x] Re-run TypeScript, ESLint, Vitest, production build, and `git diff --check`
  after final visual changes.
- [ ] Finish deployment configuration and validate the complete production flow.
- [ ] Prepare the three-to-five-minute demo narrative and recording.
- [x] Review the complete diff before staging, committing, or pushing.

## Deliberate non-goals

- **Not in scope:** Provider-specific DNS automation or write access to DNS.
- **Not in scope:** A dedicated delegation or DNS-provider handoff workflow.
- **Not in scope:** Letting users choose among Cloudflare, Google, and other DNS
  resolvers in the interface.
- **Not in scope:** Multiple-resolver consensus or continuous DNS monitoring.
- **Not in scope:** A full user-facing audit table or automatic revocation. Those
  require an append-only event store, monitoring cadence, grace period, and policy.
- **Not in scope:** Fake dashboard destinations or placeholder product features.
- **Not in scope:** Account authentication or a full workspace model; isolation is
  intentionally browser-session based.
- **Not in scope:** React Hook Form for the single domain input.
- **Not in scope:** A Postman collection; route tests and one documented manual API
  flow provide better evidence for this scope.
- **Not in scope:** A separate controller layer around thin Next.js route handlers.
