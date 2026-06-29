// Landing page ("/") — public marketing page for the notes app.
//
// A Server Component that reads the authoritative session (SPEC §7.5) so the hero
// CTA matches reality on first paint: signed-in users get a "Go to dashboard"
// button, visitors get "Get started" / "Log in". Styling follows the app's design
// language (max-w-5xl, foreground/background theme tokens, dark-mode-aware borders)
// and is responsive from a 375px mobile viewport up.

import Link from "next/link";
import { getSession } from "@/lib/auth";

const features = [
  {
    title: "Rich-text editing",
    description:
      "Headings, lists, code blocks, and inline formatting with a clean, distraction-free editor that autosaves as you type.",
  },
  {
    title: "Private by default",
    description:
      "Every note is yours alone. Authentication and server-side checks keep your writing locked to your account until you choose otherwise.",
  },
  {
    title: "Share with one link",
    description:
      "Flip a note public to get an unguessable share link. Anyone with the link can read it — revoke access anytime by turning sharing off.",
  },
];

export default async function Home() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Write rich notes. Share them with a link.
        </h1>
        <p className="max-w-xl text-base text-foreground/70 text-pretty sm:text-lg">
          A focused note-taking app for capturing ideas in rich text — kept private to your account,
          and shareable with anyone the moment you want.
        </p>

        <div className="mt-2 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          {session ? (
            <Link
              href="/dashboard"
              className="flex h-11 w-full items-center justify-center rounded-md bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/authenticate"
                className="flex h-11 w-full items-center justify-center rounded-md bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
              >
                Get started — it&apos;s free
              </Link>
              <Link
                href="/authenticate"
                className="flex h-11 w-full items-center justify-center rounded-md border border-black/10 px-6 text-sm font-medium transition-colors hover:bg-black/[.04] sm:w-auto dark:border-white/15 dark:hover:bg-white/[.06]"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <section aria-label="Features" className="grid gap-4 pb-24 sm:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="flex flex-col gap-2 rounded-lg border border-black/10 p-6 dark:border-white/15"
          >
            <h2 className="text-base font-semibold tracking-tight">{feature.title}</h2>
            <p className="text-sm text-foreground/70">{feature.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
