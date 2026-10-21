"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Claim, VerificationActivityEvent } from "@/domain/claim";
import { formatLocalDateTime } from "./format-date-time";

function activityLabel(kind: VerificationActivityEvent["kind"]) {
  switch (kind) {
    case "verified":
      return "Ownership verified";
    case "not_found":
      return "Proof record not found";
    case "wrong_value":
      return "Different TXT value found";
    case "wrong_host":
      return "Proof record found at a different host";
    case "lookup_failed":
      return "DNS lookup unavailable";
    case "already_claimed":
      return "Domain already verified elsewhere";
    default:
      return kind satisfies never;
  }
}

function VerificationHelp() {
  return (
    <div className="info-dialog-copy">
      <p>
        Only someone with access to the domain&apos;s DNS can publish this unique
        value. Rootmark compares public DNS with the exact challenge for this
        claim.
      </p>
      <ul>
        <li>Rootmark can read public DNS but cannot change your records.</li>
        <li>The value is public proof material, not a password.</li>
        <li>Only an exact match changes the domain to verified.</li>
        <li>
          After verification, removing the proof record does not change the
          verified status.
        </li>
      </ul>
    </div>
  );
}

function VerificationActivityList({ claim }: { claim: Claim }) {
  const events = [
    {
      kind: "claim_created" as const,
      observedAt: claim.createdAt,
      label: "Domain added",
    },
    ...claim.verificationActivity.map((event) => ({
      ...event,
      label: activityLabel(event.kind),
    })),
  ]
    .reverse()
    .slice(0, 5);

  return (
    <div className="activity-dialog-content">
      <ol className="activity-list">
        {events.map((event, index) => (
          <li key={`${event.kind}-${event.observedAt}-${index}`}>
            <span className="activity-marker" aria-hidden="true" />
            <div>
              <strong>{event.label}</strong>
              <time dateTime={event.observedAt}>
                {formatLocalDateTime(event.observedAt)}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {claim.verificationActivity.length > 4 ? (
        <p>Showing the five most recent meaningful transitions.</p>
      ) : null}
    </div>
  );
}

type DialogFrameProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

function DialogFrame({ children, onClose, open, title }: DialogFrameProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="info-dialog"
      aria-labelledby="info-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="info-dialog-content">
        <header>
          <h2 id="info-dialog-title">{title}</h2>
          <button type="button" onClick={close} aria-label="Close dialog">
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export type VerificationInfo = "activity" | "help" | null;

export function VerificationInfoDialog({
  claim,
  info,
  onClose,
}: {
  claim: Claim;
  info: VerificationInfo;
  onClose: () => void;
}) {
  return (
    <DialogFrame
      title={
        info === "activity"
          ? "Verification activity"
          : "How DNS verification works"
      }
      open={info !== null}
      onClose={onClose}
    >
      {info === "activity" ? (
        <VerificationActivityList claim={claim} />
      ) : (
        <VerificationHelp />
      )}
    </DialogFrame>
  );
}

type RemoveDomainDialogProps = {
  domain: string;
  error: string | null;
  isRemoving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
};

export function RemoveDomainDialog({
  domain,
  error,
  isRemoving,
  onCancel,
  onConfirm,
  open,
}: RemoveDomainDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="remove-dialog"
      aria-labelledby="remove-domain-title"
      aria-describedby="remove-domain-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!isRemoving) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isRemoving) onCancel();
      }}
    >
      <div className="remove-dialog-content">
        <div className="remove-dialog-icon" aria-hidden="true">
          !
        </div>
        <div>
          <h2 id="remove-domain-title">Remove {domain}?</h2>
          <div id="remove-domain-description" className="remove-dialog-copy">
            <p>
              This removes the domain claim and its verification activity from
              Rootmark.
            </p>
            <p>
              The <code>_rootmark</code> TXT record will remain at your DNS
              provider. Delete it there if you no longer need it.
            </p>
          </div>
        </div>
        {error ? (
          <p className="action-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="remove-dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={isRemoving}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={onConfirm}
            disabled={isRemoving}
          >
            {isRemoving ? "Removing…" : "Remove domain"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
