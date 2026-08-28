import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { AdminDashboard } from "./admin-dashboard";

// Phase 11 admin dashboard (gamify.md §64) -- moderation for what Phase 10
// built (fraud signals, reward holds, risk state) plus route/segment
// verification. Gated server-side; no admin-management UI exists to assign
// the role to anyone else yet (see lib/auth/admin.ts's own note).
export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  return <AdminDashboard />;
}
