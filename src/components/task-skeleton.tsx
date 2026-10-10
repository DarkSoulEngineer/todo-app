const ROWS = [0, 1, 2, 3];

/** Placeholder list shown while tasks load from storage. */
export function TaskSkeleton() {
  return (
    <ul className="flex flex-col gap-2.5" aria-hidden="true">
      {ROWS.map((row) => (
        <li key={row} className="flex gap-3 rounded-2xl border border-border bg-card p-3.5">
          <div className="skeleton h-6 w-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5 py-0.5">
            <div className="skeleton h-4 w-1/2 rounded-md" />
            <div className="skeleton h-3 w-3/4 rounded-md" />
            <div className="flex gap-2 pt-1">
              <div className="skeleton h-4 w-16 rounded-full" />
              <div className="skeleton h-4 w-14 rounded-full" />
              <div className="skeleton h-4 w-12 rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
