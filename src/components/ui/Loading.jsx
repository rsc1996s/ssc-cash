export function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-blue-100 ${className}`} />;
}

export default function Loading({ label = "กำลังโหลด..." }) {
  return (
    <div role="status" className="space-y-3 py-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
