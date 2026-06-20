import { Metadata } from "next";
import TribePage_v1 from "@/components/tribe-page";
import { createAdminClient } from "@/lib/supabase/admin";

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

async function fetchTribeBySerial(serial: string) {
  const db = createAdminClient();
  const { data } = await db.rpc("get_tribe_by_serial", { p_serial: serial });
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let title = "Tribe";
  try {
    const tribe = await fetchTribeBySerial(id);
    if (tribe && (tribe as { name?: string }).name) {
      const words = (tribe as { name: string }).name.split(/\s+/).filter(Boolean);
      title = words.slice(0, 5).join(" ");
    }
  } catch (error) {
    console.error("Failed to fetch tribe data for metadata:", error);
  }
  return { title };
}

export default async function TribePage({ params }: GroupPageProps) {
  const { id: tribeSerial } = await params;
  try {
    const tribe = await fetchTribeBySerial(tribeSerial);
    if (!tribe) throw new Error("not found");
    // Preserve the legacy array shape the component received.
    return (
      <div className="md:ml-[270px]">
        <TribePage_v1 tribeData={[tribe] as never} />
      </div>
    );
  } catch {
    return (
      <div className="md:ml-[270px]">
        <div>This tribe was deleted</div>
      </div>
    );
  }
}
