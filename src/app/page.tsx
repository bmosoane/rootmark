import { DomainsDashboard } from "@/components/domains/domains-dashboard";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";

export default function DomainsPage() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <WorkspaceSidebar />
      <DomainsDashboard />
    </div>
  );
}
