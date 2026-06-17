import { authOptions } from "@/auth";
import { PersonPage } from "@/components/person-page";
import { getServerSession } from "next-auth";

interface PersonPageProps {
  params: {
    id: string;
  };
}

export default async function Person({ params }: PersonPageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  const isSelfProfile = id === "me" || id === session?.user?.id;

  const personId = isSelfProfile ? (session?.user?.id as string) : id;

  return <PersonPage personId={personId} selfProfile={isSelfProfile} />;
}
