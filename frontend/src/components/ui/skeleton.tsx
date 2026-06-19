
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function TeachingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full bg-indigo-200" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56 bg-indigo-200" />
          <Skeleton className="h-4 w-32 bg-indigo-100" />
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="bg-white/60 rounded-lg p-6 space-y-4 border border-indigo-100">
        <Skeleton className="h-4 w-full bg-indigo-100" />
        <Skeleton className="h-4 w-5/6 bg-indigo-100" />
        <Skeleton className="h-4 w-4/5 bg-indigo-100" />
        <div className="space-y-3 mt-6">
          <Skeleton className="h-4 w-3/4 bg-indigo-100" />
          <Skeleton className="h-4 w-2/3 bg-indigo-100" />
          <Skeleton className="h-4 w-4/5 bg-indigo-100" />
        </div>
      </div>
      
      {/* Navigation skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-24 bg-indigo-200 rounded-lg" />
        <Skeleton className="h-4 w-16 bg-indigo-100" />
        <Skeleton className="h-10 w-32 bg-indigo-200 rounded-lg" />
      </div>
    </div>
  )
}

export { Skeleton, TeachingSkeleton }
