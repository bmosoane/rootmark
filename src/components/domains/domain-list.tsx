import { useState } from "react";
import type { Claim } from "@/domain/claim";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function listStatus(claim: Claim) {
  if (claim.status === "verified" && claim.verifiedAt) {
    return `Verified ${dateFormatter.format(new Date(claim.verifiedAt))}`;
  }
  if (claim.lastCheckedAt) {
    return `Checked ${dateFormatter.format(new Date(claim.lastCheckedAt))}`;
  }
  return "Not checked yet";
}

type DomainListProps = {
  claims: Claim[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function DomainList({ claims, selectedId, onSelect }: DomainListProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredClaims = claims.filter((claim) =>
    claim.domain.includes(normalizedQuery),
  );

  return (
    <aside
      className={`domain-index ${claims.length === 1 ? "domain-index-single" : ""}`}
      aria-label="Domains in this workspace"
    >
      <div className="domain-index-heading">
        <h2>Your domains</h2>
        <span>{claims.length}</span>
      </div>
      <label className="search-field">
        <span className="sr-only">Search domains</span>
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search domains"
        />
      </label>

      {filteredClaims.length > 0 ? (
        <ul className="domain-list">
          {filteredClaims.map((claim) => (
            <li key={claim.id}>
              <button
                type="button"
                className={`domain-row ${claim.id === selectedId ? "domain-row-selected" : ""}`}
                aria-current={claim.id === selectedId ? "page" : undefined}
                onClick={() => onSelect(claim.id)}
              >
                <span className="domain-row-copy">
                  <strong>{claim.domain}</strong>
                  <span>{listStatus(claim)}</span>
                </span>
                <span
                  className={`row-status row-status-${claim.status}`}
                  aria-label={
                    claim.status === "verified"
                      ? "Verified"
                      : "Needs verification"
                  }
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="domain-list-empty">
          <p>No domains match “{query.trim()}”.</p>
          <button
            type="button"
            className="text-button"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        </div>
      )}
    </aside>
  );
}
