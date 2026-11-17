"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Match, WaitingRoomStatus } from "@/lib/domain/types";
import { formatClock, formatCount, formatShortDay, formatTime } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { arrange, fansAdmitted, fansPerFigure, slotOf } from "@/lib/waiting-room/line";
import type { BoardText } from "./gate-board";

// The Waiting Room screen. The Fan joins, waits for the Draw, watches their
// place move, and is let in. What they see comes from the gateway (or the
// mock); this component only shows it.

// Three.js needs a browser, so the gate scene is loaded only on the client.
const GateCanvas = dynamic(() => import("./gate-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center" role="status">
      <p className="text-flood-300">Opening the gate</p>
    </div>
  ),
});

/** If the scene never shows the walk in, the Fan is taken in after this long anyway. */
const ENTER_AT_THE_LATEST_MS = 7_000;

const ACTION =
  "inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600 disabled:bg-night-800 disabled:text-flood-500";

/** The latest status, with the time it arrived so countdowns can be worked out. */
interface Reading {
  status: WaitingRoomStatus;
  at: number;
}

export function WaitingRoom({ match }: { match: Match }) {
  const matchId = match.id;
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [reading, setReading] = useState<Reading | null>(null);
  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState(false);
  /** How many were in the Waiting Room, kept once known: an admitted status no longer says. */
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  /** True once this screen has watched the Fan's place count down. */
  const [sawLine, setSawLine] = useState(false);
  const [enterPressed, setEnterPressed] = useState(false);
  const [through, setThrough] = useState(false);

  useEffect(() => {
    const take = (status: WaitingRoomStatus) => {
      setReading({ status, at: Date.now() });
      if (status.phase !== "ADMITTED") setWaitingCount(status.waiting);
      if (status.phase === "QUEUED") setSawLine(true);
    };
    return api.watchWaitingRoom(matchId, take);
  }, [matchId]);

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
  const admitted = status?.phase === "ADMITTED";
  // Let in while watching, the Fan walks straight in. Arriving already let
  // in, they wait at the turnstile until they choose to go.
  const entering = admitted && (sawLine || enterPressed);
  const seats = `/matches/${matchId}/seats`;

  const drawn = status?.phase === "QUEUED" || status?.phase === "ADMITTED" ? status.drawnPosition : null;
  const position = status?.phase === "QUEUED" ? status.position : null;
  const fanFigure =
    admitted && drawn !== null && waitingCount !== null
      ? slotOf(drawn, fansPerFigure(waitingCount))
      : null;
  // Rebuilt only when the line changes, not on every status push.
  const arrangement = useMemo(() => {
    if (admitted && drawn !== null) {
      return arrange({ phase: "ADMITTED", drawnPosition: drawn, admissionExpiresAt: "" }, fanFigure);
    }
    if (position !== null && drawn !== null && waitingCount !== null) {
      return arrange(
        { phase: "QUEUED", position, drawnPosition: drawn, waiting: waitingCount, admittedPerSecond: 0 },
        null,
      );
    }
    return arrange(undefined, null);
  }, [admitted, drawn, position, waitingCount, fanFigure]);

  const board = useMemo(() => boardText(match, reading), [match, reading]);
  const marker =
    status?.phase === "QUEUED" ? `Place ${formatCount(status.position)}` : admitted ? "Your turn" : "You";

  useEffect(() => {
    if (admitted) router.prefetch(seats);
  }, [admitted, router, seats]);

  // If the scene never says the Fan is through (no 3D on this device), take them in anyway.
  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => setThrough(true), ENTER_AT_THE_LATEST_MS);
    return () => clearTimeout(timer);
  }, [entering]);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 pb-16 pt-8 sm:px-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <section className="flex flex-col gap-4">
        <p className="text-flood-300">
          {match.home.shortName} v {match.away.shortName}
        </p>
        <h1 className="display text-[clamp(2.75rem,9vw,6rem)]">Waiting Room</h1>

        <div className="relative mt-2 aspect-[4/3] w-full overflow-hidden rounded-panel border border-night-700 bg-night-950 sm:aspect-[16/10]">
          <GateCanvas
            arrangement={arrangement}
            entering={entering}
            reducedMotion={reducedMotion}
            board={board}
            marker={marker}
            onThrough={() => setThrough(true)}
          />
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
              <button
                type="button"
                className={ACTION}
                onClick={() => setEnterPressed(true)}
                disabled={entering}
              >
                {entering ? "Going in" : "Enter the stadium"}
              </button>
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

      {through && <Flare reducedMotion={reducedMotion} onDone={() => router.push(seats)} />}
    </main>
  );
}

/** What the board over the gate says, for the Match and the latest status. */
function boardText(match: Match, reading: Reading | null): BoardText {
  const fixture = `${match.home.name} v ${match.away.name}`;
  const details = `${match.competition} · Kickoff ${formatShortDay(match.kickoffAt)} ${formatTime(match.kickoffAt)}`;
  const status = reading?.status;
  if (status?.phase === "WAITING" && reading) {
    const seconds = Math.max(0, Math.ceil((Date.parse(status.drawAt) - reading.at) / 1000));
    return { fixture, details, label: "The Draw in", value: `${seconds} s` };
  }
  const admitted = fansAdmitted(status);
  if (admitted !== null) return { fixture, details, label: "Fans admitted", value: formatCount(admitted) };
  if (status?.phase === "NOT_JOINED") {
    return { fixture, details, label: "Fans waiting", value: formatCount(status.waiting) };
  }
  return { fixture, details, label: "Waiting Room", value: "" };
}

/**
 * The light at the end of the passage filling the screen as the camera goes
 * through the gate, then the dark the stadium view opens from. With reduced
 * motion it is a short fade to the night colour. Run with the Web Animations
 * API, which the reduced-motion CSS rule leaves alone.
 */
function Flare({ reducedMotion, onDone }: { reducedMotion: boolean; onDone: () => void }) {
  const element = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const flare = element.current;
    if (!flare) return;
    const night = "var(--color-night-950)";
    const light = "var(--color-flood-50)";
    const animation = reducedMotion
      ? flare.animate(
          [
            { opacity: 0, backgroundColor: night },
            { opacity: 1, backgroundColor: night },
          ],
          { duration: 220, easing: "ease-out", fill: "forwards" },
        )
      : flare.animate(
          [
            { opacity: 0, backgroundColor: light },
            { opacity: 1, backgroundColor: light, offset: 0.45 },
            { opacity: 1, backgroundColor: night },
          ],
          { duration: 900, easing: "ease-in-out", fill: "forwards" },
        );
    animation.onfinish = () => done.current();
    return () => animation.cancel();
  }, [reducedMotion]);
  return (
    <div ref={element} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 opacity-0" />
  );
}
