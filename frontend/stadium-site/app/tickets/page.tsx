import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "My Tickets" };

// The empty state. The Tickets themselves arrive with TKT-F304.
export default function TicketsPage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-16 sm:px-12">
      <h1 className="display text-[clamp(2.25rem,8vw,5.5rem)]">My Tickets</h1>
      <p className="max-w-md text-flood-300">
        You have no Tickets yet. Pick a Match, choose your seats, and they will
        show up here.
      </p>
      <div>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600"
        >
          See the Matches
        </Link>
      </div>
    </main>
  );
}
