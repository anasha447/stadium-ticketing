import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SeatsLeft, SeatsLeftFallback } from "@/components/seats-left";
import { TierList, TierListFallback } from "@/components/tier-list";
import type { Match } from "@/lib/domain/types";
import { formatDay, formatTime } from "@/lib/format";
import { getMatch, getMatches } from "@/lib/queries";

type Props = PageProps<"/matches/[id]">;

/** The Matches we know about are built ahead of time. */
export async function generateStaticParams() {
  const matches = await getMatches();
  return matches.map((match) => ({ id: String(match.id) }));
}

async function loadMatch(params: Props["params"]): Promise<Match> {
  const { id } = await params;
  const matchId = Number(id);
  const match = Number.isInteger(matchId) ? await getMatch(matchId) : null;
  if (!match) notFound();
  return match;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const match = await loadMatch(params);
  return { title: `${match.home.shortName} v ${match.away.shortName}` };
}

export default async function MatchPage({ params }: Props) {
  const match = await loadMatch(params);
  const open = match.status === "BOOKING_OPEN";

  return (
    <main className="flex flex-1 flex-col gap-16 px-6 pb-20 pt-8 sm:px-12">
      <section className="flex flex-col gap-6">
        <p className="text-flood-300">
          {match.competition} at {match.venue}
        </p>
        <h1 className="display text-[clamp(2.75rem,10vw,7.5rem)]">
          {match.home.shortName}
          <span className="block">v {match.away.shortName}</span>
        </h1>
        <p className="text-lg">
          {formatDay(match.kickoffAt)},{" "}
          <span className="data">{formatTime(match.kickoffAt)}</span>
        </p>

        {open ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href={`/matches/${match.id}/seats`}
              className="inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600"
            >
              Choose your seats
            </Link>
            <p className="max-w-xs text-sm text-flood-300">
              Up to 4 seats each. Your seats are held for 8 minutes while you
              pay.
            </p>
          </div>
        ) : (
          <p className="max-w-md rounded-control border border-night-700 px-4 py-3 text-flood-300">
            Booking opens on{" "}
            <span className="text-flood-50">
              {formatDay(match.bookingOpensAt)} at{" "}
              <span className="data">{formatTime(match.bookingOpensAt)}</span>
            </span>
            .
          </p>
        )}
      </section>

      <section aria-labelledby="seats-left" className="flex max-w-4xl flex-col gap-4">
        <h2 id="seats-left" className="display text-3xl">
          Seats left
        </h2>
        <Suspense fallback={<SeatsLeftFallback />}>
          <SeatsLeft matchId={match.id} labelled />
        </Suspense>
        <p className="text-sm text-flood-500">
          Each cell is a Block. The brighter it is, the more seats it has left.
        </p>
      </section>

      <section aria-labelledby="prices" className="flex max-w-4xl flex-col gap-4">
        <h2 id="prices" className="display text-3xl">
          Prices
        </h2>
        <Suspense fallback={<TierListFallback />}>
          <TierList matchId={match.id} />
        </Suspense>
        <p className="text-sm text-flood-500">
          Seats together in one Row cost less: the second is 5% off, the third
          10%, the fourth 15%. The price you pay is fixed when you hold your
          seats.
        </p>
      </section>
    </main>
  );
}
