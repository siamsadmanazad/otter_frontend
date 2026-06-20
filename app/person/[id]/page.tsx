import { PersonPage } from "@/components/person-page";
import { getServerUser } from "@/lib/auth/server";

interface PersonPageProps {
  params: Promise<{ id: string }>;
}

export default async function Person({ params }: PersonPageProps) {
  const user = await getServerUser();
  const { id } = await params;

  const isSelfProfile = id === "me" || id === user?.id;
  const personId = isSelfProfile ? (user?.id as string) : id;

  return <PersonPage personId={personId} selfProfile={isSelfProfile} />;
}
