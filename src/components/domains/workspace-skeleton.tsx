export function WorkspaceSkeleton() {
  return (
    <div className="domain-workspace workspace-skeleton" aria-busy="true">
      <span className="sr-only">Loading domains</span>
      <div className="domain-index skeleton-panel" aria-hidden="true">
        <span className="skeleton-line skeleton-heading" />
        <span className="skeleton-line skeleton-search" />
        <span className="skeleton-line skeleton-row" />
        <span className="skeleton-line skeleton-row" />
      </div>
      <div className="domain-detail" aria-hidden="true">
        <div className="content-card skeleton-card">
          <div className="skeleton-card-header">
            <div>
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line skeleton-date" />
            </div>
            <span className="skeleton-line skeleton-menu" />
          </div>
          <span className="skeleton-line skeleton-card-title" />
          <span className="skeleton-line skeleton-card-copy" />
          <span className="skeleton-line skeleton-record" />
          <span className="skeleton-line skeleton-action" />
        </div>
      </div>
    </div>
  );
}
