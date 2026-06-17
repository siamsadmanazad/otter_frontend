import { getTribeBySerial } from "@/app/api/tribe/tribe.action";
import { runDBOperation } from "@/lib/useDB";
import { Metadata } from "next";
import TribePage_v1 from "@/components/tribe-page";

interface GroupPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const { id } = await params;
  let title = "Tribe";

  try {
    const tribeData = await runDBOperation(async () => {
      const tribe = await getTribeBySerial(id);
      return JSON.parse(JSON.stringify(tribe))[0];
    });
    if (tribeData && tribeData.name) {
      const words = tribeData.name.split(/\s+/).filter(Boolean);
      title = words.slice(0, 5).join(" ");
    }
  } catch (error) {
    console.error("Failed to fetch post data for metadata:", error);
  }
  return {
    title: title,
  };
}

export default async function TribePage({ params }: GroupPageProps) {
  const tribeParams = await params;
  const { id: tribeId } = tribeParams;  
  try {
    const tribeData = await runDBOperation(async () => {
      const tribe = await getTribeBySerial(tribeId);
      return JSON.parse(JSON.stringify(tribe));
    });
    return (
      <div className="md:ml-[270px]">
        <TribePage_v1 tribeData={tribeData} />
      </div>
    );
  } catch (err) {
    return (
      <div className="md:ml-[270px]">
        <div>This tribe was deleted</div>
      </div>
    );
  }
}
