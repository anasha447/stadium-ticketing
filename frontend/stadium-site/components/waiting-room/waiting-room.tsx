"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { WaitingRoomStatus } from "@/lib/domain/types";
import { formatClock, formatCount } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { CrowdField, type FieldPhase } from "./crowd-field";

// The Waiting Room screen. The Fan joins, waits for the Draw, watches their
// place move, and is let in. What they see comes from the gateway (or the
// mock); this component only shows it.

const ACTION =
  "inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600 disabled:bg-night-800 disabled:text-flood-500";

/** The latest status, with the time it arrived so countdowns can be worked out. */
interface Reading {
  status: WaitingRoomStatus;
  at: number;
}

export function WaitingRoom({ matchId, fixture }: { matchId: number; fixture: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const [reading, setReading] = useState<Reading | null>(null);
  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => api.watchWaitingRoom(matchId, (status) => setReading({ status, at: Date.now() })),
    [matchId],
  );

  const join = () => {
    setJoining(true);
    setFailed(false);
    api
      .joinWaitingRoom(matchId)
      .then((status) => setReading({ status, at: Date.now() }))
      .catch(() => setFailed(true))
      .finally(() => setJoining(false));
  };

  const status = reading?.status;
  const position = status?.phase === "QUEUED" ? status.position : null;
  const drawn = status?.phase === "QUEUED" ? status.drawnPosition : null;
  const waiting = status?.phase === "QUEUED" ? status.waiting : null;
  const field = useMemo<FieldPhase>(() => {
    if (status?.phase === "ADMITTED") return { kind: "admitted" };
    if (position !== null && drawn !== null && waiting !== null) {
      return { kind: "queue", position, drawn, waiting };
    }
    return { kind: "crowd" };
  }, [status?.phase, position, drawn, waiting]);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 pb-16 pt-8 sm:px-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <section className="flex flex-col gap-4">
        <p className="text-flood-300">{fixture}</p>
        <h1 className="display text-[clamp(2.75rem,9vw,6rem)]">Waiting Room</h1>

        <div className="relative mt-2 aspect-[4/3] w-full overflow-hidden rounded-panel border border-night-700 bg-night-900 sm:aspect-[16/10]">
          <p className="absolute inset-x-0 top-2 text-center text-xs text-flood-500">
            Into the stadium
          </p>
          <CrowdField phase={field} reducedMotion={reducedMotion} />
        </div>
      </section>

      <section aria-live="polite" className="flex flex-col gap-5 lg:pt-28">
        {!status && <p className="text-flood-300">Finding your place</p>}

        {status?.phase === "NOT_JOINED" && (
          <>
            <p className="text-lg">
              <span className="data">{formatCount(status.waiting)}</span> Fans are
              waiting for this Match.
            </p>
            <p className="text-flood-300">
              Join and you get one place in the Draw, with the same chance as
              everyone else, however early or late you came.
            </p>
            <div>
              <button type="button" className={ACTION} onClick={join} disabled={joining}>
                {joining ? "Joining" : "Join the Waiting Room"}
              </button>
            </div>
            {failed && (
              <p className="text-danger">
                You could not be added just now. Try again in a moment.
              </p>
            )}
          </>
        )}

        {status?.phase === "WAITING" && reading && (
          <>
            <p className="text-flood-300">You are in. The Draw is in</p>
            <p className="data text-6xl">
              {Math.max(0, Math.ceil((Date.parse(status.drawAt) - reading.at) / 1000))}
              <span className="text-2xl text-flood-300"> s</span>
            </p>
            <p className="text-flood-300">
              <span className="data text-flood-50">{formatCount(status.waiting)}</span>{" "}
              Fans will be shuffled at once. Nobody keeps the place they
              arrived in.
            </p>
          </>
        )}

        {status?.phase === "QUEUED" && (
          <>
            <p className="text-flood-300">Your place</p>
            <p className="data text-6xl">{formatCount(status.position)}</p>
            <p className="text-flood-300">
              The Draw gave you place{" "}
              <span className="data text-flood-50">{formatCount(status.drawnPosition)}</span>{" "}
              of <span className="data text-flood-50">{formatCount(status.waiting)}</span>.
            </p>
            <p className="text-flood-300">
              About{" "}
              <span className="data text-flood-50">
                {Math.max(1, Math.ceil(status.position / status.admittedPerSecond))}
              </span>{" "}
              seconds to go.{" "}
              <span className="data text-flood-50">{status.admittedPerSecond}</span> Fans
              a second are being let in.
            </p>
          </>
        )}

        {status?.phase === "ADMITTED" && (
          <>
            <p className="display text-5xl">You are in</p>
            <p className="text-flood-300">
              You can choose seats until{" "}
              <span className="data text-flood-50">
                {formatClock(status.admissionExpiresAt)}
              </span>
              . After that you would need to join again.
            </p>
            <div>
              <Link href={`/matches/${matchId}/seats`} className={ACTION}>
                Enter the stadium
              </Link>
            </div>
          </>
        )}

        <div className="mt-2 border-t border-night-700 pt-5 text-sm text-flood-300">
          <h2 className="font-semibold text-flood-50">Why a Draw</h2>
          <p className="mt-2">
            First come, first served rewards whoever is a millisecond faster,
            which means bots and people with twenty tabs open. The Draw gives
            every Fan one entry and the same odds.
          </p>
        </div>
      </section>
    </main>
  );
}
