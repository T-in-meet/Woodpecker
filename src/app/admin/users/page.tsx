import { AdminUsersClient } from "@/features/admin/users/components/AdminUsersClient";
import { requireAdmin } from "@/features/admin/utils/require-admin";

export default async function AdminUsersPage() {
  const currentAdminId = await requireAdmin();

  return <AdminUsersClient currentAdminId={currentAdminId} />;
}
