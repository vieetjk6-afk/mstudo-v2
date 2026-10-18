import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import SystemPanel from "./SystemPanel";
import AdminDriveCard from "./AdminDriveCard";
import AiProvidersEditor from "@/components/AiProvidersEditor";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <SystemPanel />
      <AdminDriveCard />
      <AiProvidersEditor scope="shared" />
    </div>
  );
}
