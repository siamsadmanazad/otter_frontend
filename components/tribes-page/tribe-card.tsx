import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Globe } from "lucide-react";
import Link from "next/link";
import { ITribe } from "@/types/tribes";
import { useRouter } from "next/navigation";

/**
 * Renders a card for a group using the ITribe data type.
 * @param {object} props - The component props.
 * @param {ITribe} props.group - The group data to display.
 */
export const TribeCard = ({ group }: { group: ITribe }) => {
  const router = useRouter();
  const onVisitTribe = () => {
    router.push(`/tribes/${group.serial}`);
  };
  return (
    <Card className="overflow-hidden rounded-xl hover:shadow-lg transition-shadow group bg-white dark:bg-slate-800 dark:border-slate-700">
      {/* Cover Image Section */}
      <div
        className="relative h-32 bg-cover bg-center"
        style={{ backgroundImage: `url(${group.coverImage})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-30" />

        {/* Privacy Badge */}
        {group.privacy === "PRIVATE" ? (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-violet-500 bg-opacity-50 text-white px-2 py-1 rounded-full text-xs font-semibold">
            <Lock className="w-3 h-3" />
            {group.privacy}
          </div>
        ) : (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-teal-500 bg-opacity-50 text-white px-2 py-1 rounded-full text-xs font-semibold">
            <Globe className="w-3 h-3" />
            {group.privacy}
          </div>
        )}

        {/* Profile Image Avatar */}
        <div className="absolute bottom-3 left-3 transform -translate-y-1/2">
          <Avatar className="w-16 h-16 border-4 border-white dark:border-slate-800">
            <AvatarImage
              src={group.profileImage || "/placeholder.svg"}
              alt={group.name}
            />
            <AvatarFallback>
              {group.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Content Section */}
      <CardContent className="p-4 pt-10">
        <div className="mb-3">
          <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white hover:text-blue-500 underline duration-300">
            <Link href={`/tribes/${group.serial}`}>{group.name}</Link>
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 mb-2">
            {group.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {group.tags.map((tag: string) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs rounded-full"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onVisitTribe}
            className="flex-1 rounded-full font-semibold hover:shadow-sm duration-300"
          >
            View Tribe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
