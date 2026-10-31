export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skel ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 !rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export default function Loader({ label = "Loading", full = false }: { label?: string; full?: boolean }) {
  if (!full) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-4" role="status" aria-label={label}>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  // Full-page version: looks like the app is already there and filling in
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden" style={{ background: "var(--bg)" }} role="status" aria-label={label}>
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-12 w-24" />
        </div>
        <Skeleton className="h-40 w-full !rounded-2xl" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-indigo-200 p-3 flex justify-around">
        <Skeleton className="h-10 w-14" />
        <Skeleton className="h-10 w-14" />
        <Skeleton className="h-10 w-14" />
      </div>
    </div>
  );
}