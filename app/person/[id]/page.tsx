import { PersonPage } from "@/components/person-page";
import { getServerUser } from "@/lib/auth/server";

interface PersonPageProps {
  params: Promise<{ id: string }>;
}

export default async function Person({ params }: PersonPageProps) {
  const user = await getServerUser();
  const { id } = await params;

  // profileId, not id: "is this me" is a question about the profile being acted
  // as, not the underlying account (business_mode.md 0.1b).
  const isSelfProfile = id === "me" || id === user?.profileId;
  const personId = isSelfProfile ? (user?.profileId as string) : id;

  return <PersonPage personId={personId} selfProfile={isSelfProfile} />;
}
