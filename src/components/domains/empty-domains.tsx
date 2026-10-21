type EmptyDomainsProps = {
  onAdd: () => void;
};

const steps = [
  {
    title: "Add a domain",
    copy: "Enter the domain or subdomain you want to prove.",
  },
  {
    title: "Publish one TXT record",
    copy: "Rootmark creates a unique value for its public DNS.",
  },
  {
    title: "Check the proof",
    copy: "We compare the public record with the exact value issued.",
  },
] as const;

export function EmptyDomains({ onAdd }: EmptyDomainsProps) {
  return (
    <section className="empty-domains" aria-labelledby="empty-domains-title">
      <div className="empty-domains-intro">
        <span className="empty-domains-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="6" width="18" height="12" rx="3" />
            <circle cx="8" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="16" cy="12" r="1" />
          </svg>
        </span>
        <h2 id="empty-domains-title">No domains on record yet</h2>
        <p>
          Prove that you control a domain by publishing one harmless TXT record.
          Rootmark reads public DNS and shows exactly what it observed.
        </p>
        <button type="button" onClick={onAdd}>
          Add your first domain
        </button>
      </div>

      <ol className="empty-domain-steps" aria-label="How domain proof works">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="empty-domains-note">
        Rootmark only reads public DNS. It cannot add, change, or delete your
        records.
      </p>
    </section>
  );
}
