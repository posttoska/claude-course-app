"use client";

// Renders a note timestamp in the VIEWER's locale + timezone. This must be a
// client component: the server doesn't know the visitor's timezone, so a
// server-formatted date can be off by a calendar day at the UTC boundary.
// `suppressHydrationWarning` lets the server's fallback render be corrected to
// local time on hydration without a mismatch warning.
export function NoteDate({ iso }: { iso: string }) {
  const label = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));

  return (
    <time dateTime={iso} suppressHydrationWarning className="shrink-0 text-xs text-foreground/50">
      {label}
    </time>
  );
}
