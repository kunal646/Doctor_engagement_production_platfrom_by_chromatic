import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function SupervisorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("supervisor");
  return (
    <DashboardShell
      title="Supervisor Portal"
      subtitle={profile.full_name || profile.email}
      items={[
        { href: "/supervisor/dashboard", label: "Dashboard" },
        { href: "/supervisor/operators", label: "Operators" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
