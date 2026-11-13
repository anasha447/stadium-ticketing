import Link from "next/link";

// Placeholder until TKT-F103 brings the match list. It only proves the
// design system is wired: night background, display type, one orange action.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-end gap-8 px-6 py-12 sm:px-12 sm:py-16">
      <p className="data text-sm text-flood-300">La Liga · Spotify Camp Nou</p>
      <h1 className="display text-[clamp(3.5rem,13vw,10rem)]">
        Barcelona
        <span className="block text-flood-500">vs Espanyol</span>
      </h1>
      <p className="max-w-md text-lg text-flood-300">
        The Barcelona Derby. Pick your seat in 3D and see the pitch from it
        before you pay.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/design"
          className="inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600"
        >
          See the design system
        </Link>
        <span className="text-sm text-flood-500">
          Booking screens arrive with the next tickets.
        </span>
      </div>
    </main>
  );
}
