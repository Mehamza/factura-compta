import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-2">
          <Skeleton className="h-5 col-span-2" />
          <Skeleton className="h-5 col-span-1" />
          <Skeleton className="h-5 col-span-1" />
          <Skeleton className="h-5 col-span-1" />
          <Skeleton className="h-5 col-span-1" />
        </div>
      ))}
    </div>
  );
}
