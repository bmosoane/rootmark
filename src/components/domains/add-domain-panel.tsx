"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Claim } from "@/domain/claim";
import type {
  ApiErrorResponse,
  CreateClaimResponse,
} from "@/domain/claim-api";
import { isApiErrorResponse } from "@/domain/claim-api";

type AddDomainPanelProps = {
  isFirstDomain: boolean;
  onCancel: () => void;
  onCreated: (claim: Claim) => void;
};

export function AddDomainPanel({
  isFirstDomain,
  onCancel,
  onCreated,
}: AddDomainPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const domain = String(new FormData(form).get("domain") ?? "");

    startCreating(async () => {
      try {
        const response = await fetch("/api/claims", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain }),
        });
        const body = (await response.json()) as
          | CreateClaimResponse
          | ApiErrorResponse;

        if (!response.ok || isApiErrorResponse(body) || !("claim" in body)) {
          const message = isApiErrorResponse(body)
            ? body.error
            : "We could not add the domain. Try again.";
          setError(message);
          return;
        }

        form.reset();
        onCreated(body.claim);
      } catch {
        setError("We could not reach Rootmark. Check your connection and try again.");
      }
    });
  }

  return (
    <section className="add-domain-panel" aria-labelledby="add-domain-title">
      <div className="panel-heading">
        <div>
          <h2 id="add-domain-title">
            {isFirstDomain ? "Add your first domain" : "Add another domain"}
          </h2>
          <p>
            We&apos;ll create one TXT record that proves you can manage its DNS.
          </p>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <form className="add-domain-form" onSubmit={submit} noValidate>
        <label htmlFor="domain">Domain</label>
        <div className="input-row">
          <input
            id="domain"
            name="domain"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="example.com"
            autoFocus
            required
            maxLength={300}
            aria-describedby={error ? "domain-help claim-error" : "domain-help"}
            aria-invalid={Boolean(error)}
          />
          <button type="submit" disabled={isCreating}>
            {isCreating ? "Adding…" : "Add domain"}
          </button>
        </div>
        <p id="domain-help" className="field-help">
          Enter a domain or subdomain without <code>https://</code> or a path.
        </p>
        {error ? (
          <p
            id="claim-error"
            className="form-error"
            role="alert"
            tabIndex={-1}
            ref={errorRef}
          >
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
