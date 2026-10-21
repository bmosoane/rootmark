"use client";

import { useEffect } from "react";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unexpected domains page error", error);
  }, [error]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <WorkspaceSidebar />
      <main id="main-content" className="dashboard-main" tabIndex={-1}>
        <header className="dashboard-header">
          <div>
            <h1>Domains</h1>
            <p>Verify that you control a domain with a DNS record.</p>
          </div>
        </header>
        <section className="load-error" role="alert">
          <h2>Something went wrong</h2>
          <p>
            We could not display this page. Your domain records have not been
            changed.
          </p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </section>
      </main>
    </div>
  );
}
