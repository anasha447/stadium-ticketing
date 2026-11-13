import Link from "next/link";
import { Suspense } from "react";
import { SeatsLeft, SeatsLeftFallback } from "@/components/seats-left";
import type { Match } from "@/lib/domain/types";
import { formatDay, formatShortDay, formatTime } from "@/lib/format";
import { getMatches } from "@/lib/queries";

export default async function Home() {
  const matches = await getMatches();
  // The Match a Fan can book right now leads the page; the rest are a list.
  const lead = matches.find((match) => match.status === "BOOKING_OPEN");
  const rest = matches.filter((match) => match !== lead);

  return (
    <main className="flex flex-1 flex-col gap-20 px-6 pb-20 pt-10 sm:px-12 sm:pt-16">
      {lead && <LeadMatch match={lead} />}
      {rest.length > 0 && (
        <section aria-labelledby="coming-up" className="flex flex-col gap-4">
          <h2 id="coming-up" className="display text-3xl">
            {lead ? "Coming up" : "Matches"}
          </h2>
          <ul className="border-t border-night-700">
            {rest.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function LeadMatch({ match }: { match: Match }) {
  return (
    <section className="flex flex-col gap-8">
      <p className="text-flood-300">
        {formatDay(match.kickoffAt)},{" "}
        <span className="data text-flood-50">{formatTime(match.kickoffAt)}</span>{" "}
        at {match.venue}
      </p>
      <h1 className="display text-[clamp(3.5rem,14vw,11rem)]">
        {match.home.shortName}
        <span className="block">{match.away.shortName}</span>
      </h1>
      <div className="max-w-3xl">
        <Suspense fallback={<SeatsLeftFallback />}>
          <SeatsLeft matchId={match.id} />
        </Suspense>
      </div>
      <div>
        <Link
          href={`/matches/${match.id}`}
          className="inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600"
        >
          Get tickets
        </Link>
      </div>
    </section>
  );
}

function MatchRow({ match }: { match: Match }) {
  return (
    <li className="border-b border-night-700">
      <Link
        href={`/matches/${match.id}`}
        className="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-6 gap-y-1 py-4 transition-colors duration-fast hover:bg-night-900 sm:grid-cols-[8rem_1fr_auto] sm:px-3"
      >
        <span className="data text-sm text-flood-300">
          {formatShortDay(match.kickoffAt)}
        </span>
        <span className="display text-2xl sm:text-3xl">
          {match.home.shortName} v {match.away.shortName}
        </span>
        <span className="col-start-2 text-sm text-flood-300 sm:col-start-3">
          Booking opens {formatShortDay(match.bookingOpensAt)}
        </span>
      </Link>
    </li>
  );
}
