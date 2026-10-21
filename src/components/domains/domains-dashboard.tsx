"use client";

import { useEffect, useState } from "react";
import { AddDomainPanel } from "@/components/domains/add-domain-panel";
import { ClaimDetail } from "@/components/domains/claim/claim-detail";
import { DomainList } from "@/components/domains/domain-list";
import { EmptyDomains } from "@/components/domains/empty-domains";
import { WorkspaceSkeleton } from "@/components/domains/workspace-skeleton";
import type { Claim } from "@/domain/claim";
import type { ApiErrorResponse, ListClaimsResponse } from "@/domain/claim-api";
import { isApiErrorResponse } from "@/domain/claim-api";

type ClaimsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; claims: Claim[] };

export function DomainsDashboard() {
  const [state, setState] = useState<ClaimsState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadClaims() {
      setState({ status: "loading" });
      try {
        const response = await fetch("/api/claims", {
          signal: controller.signal,
        });
        const body = (await response.json()) as
          | ListClaimsResponse
          | ApiErrorResponse;

        if (!response.ok || isApiErrorResponse(body) || !("claims" in body)) {
          throw new Error("Could not load domains");
        }
        setState({ status: "ready", claims: body.claims });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message: "We could not load your domains.",
        });
      }
    }

    void loadClaims();
    return () => controller.abort();
  }, [reloadKey]);

  const claims = state.status === "ready" ? state.claims : [];
  const selectedClaim =
    claims.find((claim) => claim.id === selectedId) ?? claims[0] ?? null;
  const showAddPanel = state.status === "ready" && isAddOpen;

  function addClaim(claim: Claim) {
    setState((current) => {
      if (current.status !== "ready") return current;
      return {
        status: "ready",
        claims: [
          claim,
          ...current.claims.filter((item) => item.id !== claim.id),
        ],
      };
    });
    setSelectedId(claim.id);
    setIsAddOpen(false);
  }

  function updateClaim(updated: Claim) {
    setState((current) => {
      if (current.status !== "ready") return current;
      return {
        status: "ready",
        claims: current.claims.map((claim) =>
          claim.id === updated.id ? updated : claim,
        ),
      };
    });
  }

  function removeClaim(claimId: string) {
    setState((current) => {
      if (current.status !== "ready") return current;
      return {
        status: "ready",
        claims: current.claims.filter((claim) => claim.id !== claimId),
      };
    });
    setSelectedId(null);
  }

  return (
    <main id="main-content" className="dashboard-main" tabIndex={-1}>
      <header className="dashboard-header">
        <div>
          <h1>Domains</h1>
          <p>Verify that you control a domain with a DNS record.</p>
        </div>
        {state.status === "ready" && claims.length > 0 && !isAddOpen ? (
          <button
            className="header-button"
            type="button"
            onClick={() => setIsAddOpen(true)}
          >
            Add domain
          </button>
        ) : null}
      </header>

      {showAddPanel ? (
        <div className={claims.length === 0 ? "add-domain-workspace" : undefined}>
          <AddDomainPanel
            isFirstDomain={claims.length === 0}
            onCancel={() => setIsAddOpen(false)}
            onCreated={addClaim}
          />
        </div>
      ) : null}

      {state.status === "loading" ? <WorkspaceSkeleton /> : null}

      {state.status === "error" ? (
        <section className="load-error" role="alert">
          <h2>Domains could not be loaded</h2>
          <p>{state.message} This may be temporary. Try again.</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </section>
      ) : null}

      {state.status === "ready" && claims.length === 0 && !isAddOpen ? (
        <EmptyDomains onAdd={() => setIsAddOpen(true)} />
      ) : null}

      {state.status === "ready" && claims.length > 0 ? (
        <div className="domain-workspace">
          <DomainList
            claims={claims}
            selectedId={selectedClaim?.id ?? null}
            onSelect={setSelectedId}
          />
          {selectedClaim ? (
            <ClaimDetail
              key={selectedClaim.id}
              claim={selectedClaim}
              onRemove={removeClaim}
              onUpdate={updateClaim}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
