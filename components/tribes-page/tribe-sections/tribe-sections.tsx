import { Crown, Users, Lock, Flame } from "lucide-react";
import { CreatedTribes } from "./created-tribes";
import { JoinedPublicTribes } from "./joined-public-tribes";
import { JoinedPrivateTribes } from "./joined-private-tribes";
import { SuggestedTribes } from "./suggested-tribes";

export function CreatedTribesSection() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex flex-row gap-2">
        <Crown className="mt-1 animate-float" />
        Your Created Tribes
      </h1>
      <div>
        <CreatedTribes />
      </div>
    </div>
  );
}

export function PublicTribesSection() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex flex-row gap-2">
        <Users className="mt-1 animate-float" />
        Public Tribes
      </h1>
      <div>
        <JoinedPublicTribes />
      </div>
    </div>
  );
}

export function PrivateTribesSection() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex flex-row gap-2">
        <Lock className="mt-1 animate-float" />
        Private Tribes
      </h1>
      <div>
        <JoinedPrivateTribes />
      </div>
    </div>
  );
}

export function SuggestedTribesSection() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex flex-row gap-2">
        <Flame className="mt-1 animate-float" />
        Tribes to discover
      </h1>
      <div>
        <SuggestedTribes />
      </div>
    </div>
  );
}