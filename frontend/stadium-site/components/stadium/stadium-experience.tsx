"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { api } from "@/lib/api";
import type { Block, Currency } from "@/lib/domain/types";
import { formatCount, formatMoney, TIER_NAME, TIER_SWATCH } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { seatAtPoint, seatOnRay } from "@/lib/stadium/layout";
import {
  availableCount,
  isAvailable,
  nextAvailableRow,
  nextAvailableSeat,
  STADIUM,
  viewReducer,
} from "@/lib/stadium/view";
import type { StandClick } from "./bowl";

// The stadium a Fan moves through: the whole bowl, then a Block, then a seat.
// This component decides where the Fan is and loads what that needs; the
// canvas draws it and the panel says it in words.

// Three.js needs a browser, so the canvas is loaded only on the client, and
// only on this page: no other page pays for the 3D code.
const StadiumCanvas = dynamic(() => import("./stadium-canvas"), {
  ssr: false,
  loading: () => <StadiumLoading />,
});

export function StadiumLoading() {
  return (
    <div className="flex h-full items-center justify-center" role="status">
      <p className="text-flood-300">Building the stadium</p>
    </div>
  );
}

const QUIET_BUTTON =
  "h-11 rounded-control border border-night-700 px-4 text-sm font-semibold transition-colors duration-fast hover:bg-night-800 disabled:text-flood-500 disabled:hover:bg-transparent";

const pad = (n: number) => String(n).padStart(2, "0");

export function StadiumExperience({
  matchId,
  title,
  blocks,
  currency,
}: {
  matchId: number;
  title: string;
  blocks: Block[];
  currency: Currency;
}) {
  const [view, dispatch] = useReducer(viewReducer, STADIUM);
  const reducedMotion = usePrefersReducedMotion();
  /** Seat States of the Blocks opened so far, by Block id. */
  const [states, setStates] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);

  const blockId = view.kind === "stadium" ? null : view.blockId;
  const block = blockId ? blocks.find((b) => b.id === blockId) : undefined;
  const blockStates = blockId ? states[blockId] : undefined;

  // Seat States are per Fan and change by the second, so they are read here
  // in the browser when a Block is opened, never on the server.
  useEffect(() => {
    if (!blockId || blockStates !== undefined) return;
    let cancelled = false;
    api
      .getSeatStates(matchId, [blockId])
      .then((result) => {
        if (cancelled) return;
        setStates((known) => ({ ...known, ...result.blocks }));
        setFailed(null);
      })
      .catch(() => {
        if (!cancelled) setFailed(blockId);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, blockId, blockStates]);

  const open = useMemo(
    () => (blockId && blockStates ? { blockId, states: blockStates } : null),
    [blockId, blockStates],
  );

  const handleStandClick = useCallback(
    (click: StandClick) => {
      const guess = seatAtPoint(blocks, click.point[0], click.point[2]);
      if (!guess) return;
      const { block: clicked, row, seat } = seatOnRay(guess, click.origin, click.direction);

      // A click on another Block always goes to that Block.
      if (clicked.id !== blockId) {
        dispatch({ type: "openBlock", blockId: clicked.id });
        return;
      }
      // In the open Block, only an available seat can be sat in.
      if (blockStates && isAvailable(clicked, blockStates, row, seat)) {
        dispatch({ type: "sit", blockId: clicked.id, row, seat });
      }
    },
    [blocks, blockId, blockStates],
  );

  // Where the four seat buttons would take the Fan, or null if nowhere.
  // Seat numbers run clockwise, which is to the left of a Fan facing the pitch.
  const moves = useMemo(() => {
    if (view.kind !== "seat" || !block || !blockStates) return null;
    const along = (step: -1 | 1) => {
      const seat = nextAvailableSeat(block, blockStates, view.row, view.seat, step);
      return seat === null ? null : { row: view.row, seat };
    };
    return {
      left: along(1),
      right: along(-1),
      closer: nextAvailableRow(block, blockStates, view.row, view.seat, -1),
      back: nextAvailableRow(block, blockStates, view.row, view.seat, 1),
    };
  }, [view, block, blockStates]);

  const sit = useCallback(
    (to: { row: number; seat: number } | null) => {
      if (to && blockId) dispatch({ type: "sit", blockId, ...to });
    },
    [blockId],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch({ type: "back" });
      if (!moves) return;
      const to = {
        ArrowLeft: moves.left,
        ArrowRight: moves.right,
        ArrowUp: moves.closer,
        ArrowDown: moves.back,
      }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      sit(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moves, sit]);

  return (
    <>
      <StadiumCanvas
        blocks={blocks}
        view={view}
        open={open}
        reducedMotion={reducedMotion}
        onStandClick={handleStandClick}
      />

      <section
        aria-live="polite"
        className="glass absolute inset-x-4 bottom-4 flex flex-col gap-3 px-4 py-4 sm:inset-x-auto sm:bottom-auto sm:left-8 sm:top-4 sm:w-80"
      >
        {view.kind === "stadium" && (
          <>
            <h1 className="display text-2xl">{title}</h1>
            <p className="text-sm text-flood-300">
              Click a Block to fly in. Drag to spin the stadium, scroll or pinch
              to zoom.
            </p>
          </>
        )}

        {view.kind !== "stadium" && block && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="display text-3xl">Block {block.id}</h1>
              <p className="flex items-center gap-2 text-sm text-flood-300">
                <span className={`size-3 ${TIER_SWATCH[block.tier]}`} aria-hidden />
                {TIER_NAME[block.tier]}
              </p>
            </div>

            {view.kind === "block" && (
              <>
                <p className="text-sm text-flood-300">
                  {failed === block.id ? (
                    "This Block's seats could not be loaded. Go back and open it again."
                  ) : blockStates === undefined ? (
                    "Loading the seats"
                  ) : (
                    <>
                      <span className="data text-base text-flood-50">
                        {formatCount(availableCount(blockStates))}
                      </span>{" "}
                      seats left at{" "}
                      <span className="data text-base text-flood-50">
                        {formatMoney(block.basePrice, currency)}
                      </span>
                      . Click one to sit in it.
                    </>
                  )}
                </p>
                <StateKey tierSwatch={TIER_SWATCH[block.tier]} />
              </>
            )}

            {view.kind === "seat" && (
              <>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-flood-300">Row</dt>
                    <dd className="data text-lg">{pad(view.row)}</dd>
                  </div>
                  <div>
                    <dt className="text-flood-300">Seat</dt>
                    <dd className="data text-lg">{pad(view.seat)}</dd>
                  </div>
                  <div>
                    <dt className="text-flood-300">Price</dt>
                    <dd className="data text-lg">{formatMoney(block.basePrice, currency)}</dd>
                  </div>
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={QUIET_BUTTON} disabled={!moves?.left} onClick={() => sit(moves?.left ?? null)}>
                    Seat to the left
                  </button>
                  <button type="button" className={QUIET_BUTTON} disabled={!moves?.right} onClick={() => sit(moves?.right ?? null)}>
                    Seat to the right
                  </button>
                  <button type="button" className={QUIET_BUTTON} disabled={!moves?.closer} onClick={() => sit(moves?.closer ?? null)}>
                    Row in front
                  </button>
                  <button type="button" className={QUIET_BUTTON} disabled={!moves?.back} onClick={() => sit(moves?.back ?? null)}>
                    Row behind
                  </button>
                </div>
                <p className="text-xs text-flood-500">
                  Drag to look around, scroll to zoom. The arrow keys move you
                  to the next available seat.
                </p>
              </>
            )}

            <button type="button" className={QUIET_BUTTON} onClick={() => dispatch({ type: "back" })}>
              {view.kind === "seat" ? `Back to Block ${block.id}` : "Back to the stadium"}
            </button>
          </>
        )}
      </section>
    </>
  );
}

/** What the seat colours mean once a Block is open. */
function StateKey({ tierSwatch }: { tierSwatch: string }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-flood-300">
      <li className="flex items-center gap-2">
        <span className={`size-3 ${tierSwatch}`} aria-hidden /> Available
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 bg-state-held" aria-hidden /> Held
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 bg-state-sold" aria-hidden /> Sold
      </li>
    </ul>
  );
}
