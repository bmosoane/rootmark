"use client";

import { useRef, useState, useTransition } from "react";
import type { CheckResult, Claim } from "@/domain/claim";
import { challengeFor } from "@/domain/claim";
import type {
  ApiErrorResponse,
  CheckClaimResponse,
} from "@/domain/claim-api";
import { isApiErrorResponse } from "@/domain/claim-api";
import {
  RemoveDomainDialog,
  VerificationInfoDialog,
} from "./claim-dialogs";
import type { VerificationInfo } from "./claim-dialogs";
import { CheckResultMessage } from "./check-result";
import { formatLocalDateTime } from "./format-date-time";

function formatDate(value: string | null) {
  return value ? formatLocalDateTime(value) : "Not checked yet";
}

function StatusBadge({ status }: { status: Claim["status"] }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {status === "verified" ? "Verified" : "Needs verification"}
    </span>
  );
}

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1_800);
  }

  const text =
    state === "copied"
      ? "Copied"
      : state === "failed"
        ? "Copy failed"
        : label;

  return (
    <button
      className="copy-button"
      type="button"
      onClick={copy}
      aria-live="polite"
    >
      {text}
    </button>
  );
}

type Challenge = ReturnType<typeof challengeFor>;

function DnsRecordFields({ challenge }: { challenge: Challenge }) {
  return (
    <table className="dns-table record-table" aria-label="DNS record to add">
      <tbody>
        <tr>
          <th scope="row">Type</th>
          <td colSpan={2}>
            <code>{challenge.type}</code>
          </td>
        </tr>
        <tr>
          <th scope="row">Host</th>
          <td>
            <code>{challenge.host}</code>
          </td>
          <td className="record-copy-cell">
            <CopyButton value={challenge.host} />
          </td>
        </tr>
        <tr>
          <th scope="row">Value</th>
          <td>
            <code>{challenge.value}</code>
          </td>
          <td className="record-copy-cell">
            <CopyButton value={challenge.value} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

type ClaimDetailProps = {
  claim: Claim;
  onRemove: (claimId: string) => void;
  onUpdate: (claim: Claim) => void;
};

export function ClaimDetail({ claim, onRemove, onUpdate }: ClaimDetailProps) {
  const actionsButtonRef = useRef<HTMLElement>(null);
  const [isChecking, startChecking] = useTransition();
  const [isRemoving, startRemoving] = useTransition();
  const [transientResult, setTransientResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [openInfo, setOpenInfo] = useState<VerificationInfo>(null);
  const challenge = challengeFor(claim);
  const result = transientResult ?? claim.latestResult;
  const activityCount = Math.min(claim.verificationActivity.length + 1, 5);
  function closeRemovalDialog() {
    setConfirmingRemoval(false);
    setRemovalError(null);
    window.requestAnimationFrame(() => actionsButtonRef.current?.focus());
  }

  function check() {
    setCheckError(null);
    startChecking(async () => {
      try {
        const response = await fetch(`/api/claims/${claim.id}/check`, {
          method: "POST",
        });
        const body = (await response.json()) as
          | CheckClaimResponse
          | ApiErrorResponse;

        if (response.status === 404) {
          onRemove(claim.id);
          return;
        }
        if (isApiErrorResponse(body)) {
          setCheckError(body.error);
          return;
        }
        if (!("claim" in body) || !("result" in body)) {
          throw new Error("Malformed check response");
        }

        onUpdate(body.claim);
        setTransientResult(body.result);
      } catch {
        setCheckError(
          "We could not reach Rootmark. Your verification state did not change.",
        );
      }
    });
  }

  function remove() {
    setRemovalError(null);
    startRemoving(async () => {
      try {
        const response = await fetch(`/api/claims/${claim.id}`, {
          method: "DELETE",
        });

        if (response.status === 404) {
          onRemove(claim.id);
          return;
        }
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          setRemovalError(
            isApiErrorResponse(body)
              ? body.error
              : "We could not remove this domain. Try again.",
          );
          return;
        }

        onRemove(claim.id);
      } catch {
        setRemovalError(
          "We could not reach Rootmark. The domain was not removed.",
        );
      }
    });
  }

  return (
    <div className="domain-detail">
      <section
        className="content-card verification-card"
        aria-labelledby={`domain-${claim.id}`}
      >
        <header className="domain-card-header">
          <div>
            <div className="domain-card-title">
              <h2 id={`domain-${claim.id}`}>{claim.domain}</h2>
              <StatusBadge status={claim.status} />
            </div>
            <p>Created {formatDate(claim.createdAt)}</p>
          </div>
          <details className="domain-actions">
            <summary
              ref={actionsButtonRef}
              aria-label={`Actions for ${claim.domain}`}
            >
              •••
            </summary>
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                setRemovalError(null);
                setConfirmingRemoval(true);
              }}
            >
              Remove domain
            </button>
          </details>
        </header>

        <RemoveDomainDialog
          domain={claim.domain}
          error={removalError}
          isRemoving={isRemoving}
          onCancel={closeRemovalDialog}
          onConfirm={remove}
          open={confirmingRemoval}
        />

        <VerificationInfoDialog
          claim={claim}
          info={openInfo}
          onClose={() => setOpenInfo(null)}
        />

        {claim.status === "verified" ? (
          <>
            <section
              className="verified-status"
              aria-labelledby="verification-title"
            >
              <div className="success-heading">
                <div>
                  <h3 id="verification-title">Domain ownership verified</h3>
                  <p>We found the exact proof record in public DNS.</p>
                </div>
              </div>
            </section>

            <div className="evidence-section">
              <table className="dns-table evidence-table">
                <caption className="sr-only">Verification evidence</caption>
                <tbody>
                  <tr>
                    <th scope="row">Method</th>
                    <td>DNS TXT record</td>
                  </tr>
                  <tr>
                    <th scope="row">Verified</th>
                    <td>{formatDate(claim.verifiedAt)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Record checked</th>
                    <td>
                      <code>{challenge.fqdn}</code>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Proof value</th>
                    <td>
                      <code>{challenge.value}</code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="verification-section setup-section">
            <div className="panel-heading record-heading">
              <div>
                <h3 id="verification-title">Add this DNS record</h3>
                <p>
                  Add it where the nameservers for {claim.domain} are managed.
                </p>
              </div>
            </div>
            <DnsRecordFields challenge={challenge} />
            <div className="safety-note">
              <span aria-hidden="true">i</span>
              <p>
                <strong>Keep existing records.</strong> Add this as a new TXT
                record; do not replace SPF, DKIM, or other TXT values.
              </p>
            </div>
            <div className="verification-action-row">
              <button
                className="primary-button verification-button"
                type="button"
                onClick={check}
                disabled={isChecking}
              >
                {isChecking ? "Checking public DNS…" : "Check DNS record"}
              </button>
            </div>
          </div>
        )}

        {checkError ? (
          <p className="action-error" role="alert">
            {checkError}
          </p>
        ) : null}

        {claim.status !== "verified" && result ? (
          <div
            className="verification-section observation-section"
            aria-labelledby={`latest-${claim.id}`}
          >
            <div className="panel-heading observation-heading">
              <div>
                <h3 id={`latest-${claim.id}`}>Last check</h3>
                <p>What the verifier found in public DNS.</p>
              </div>
              <time
                dateTime={
                  result.kind === "rate_limited" ? undefined : result.checkedAt
                }
              >
                {result.kind === "rate_limited"
                  ? "Just now"
                  : formatDate(result.checkedAt)}
              </time>
            </div>
            <CheckResultMessage result={result} />
          </div>
        ) : null}

        <footer className="verification-footer">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpenInfo("help")}
          >
            How DNS verification works
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpenInfo("activity")}
          >
            Verification activity{" "}
            <span>
              · {activityCount} {activityCount === 1 ? "event" : "events"}
            </span>
          </button>
        </footer>
      </section>
    </div>
  );
}
