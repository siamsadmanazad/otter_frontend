import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Renders a skeleton loading state for the TribeCard.
 */
export const TribeCardSkeleton = () => {
  return (
    <Card className="overflow-hidden rounded-xl hover:shadow-lg transition-shadow bg-white dark:bg-slate-800 dark:border-slate-700">
      {/* Cover Image Section */}
      <div className="relative h-32 w-full">
        <Skeleton className="h-full w-full rounded-b-none" />
        <div className="absolute top-3 right-3">
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="absolute bottom-3 left-3 transform -translate-y-1/2">
          <Skeleton className="w-16 h-16 rounded-full border-4 border-white dark:border-slate-800" />
        </div>
      </div>

      {/* Content Section */}
      <CardContent className="p-4 pt-10">
        <div className="mb-3">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <div className="flex flex-wrap gap-1 mb-3">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>

        {/* Button Section */}
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
};
