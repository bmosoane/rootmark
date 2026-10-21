import Link from "next/link";

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="6" r="2" fill="currentColor" />
      <path
        d="M12 8v6m0 0-5 5m5-5 5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx="7" cy="19" r="1.5" fill="currentColor" />
      <circle cx="17" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function WorkspaceSidebar() {
  return (
    <aside className="sidebar">
      <Link className="wordmark" href="/" aria-label="Rootmark home">
        <span className="wordmark-mark">
          <BrandMark />
        </span>
        <span>Rootmark</span>
      </Link>
      <nav aria-label="Workspace navigation">
        <span className="nav-label">Workspace</span>
        <span className="nav-item nav-item-active" aria-current="page">
          <span aria-hidden="true">◎</span>Domains
        </span>
      </nav>
      <div className="session-indicator">
        <span aria-hidden="true" />
        <div>
          <strong>Private browser session</strong>
          <p>Claims are available only in this browser.</p>
        </div>
      </div>
    </aside>
  );
}
