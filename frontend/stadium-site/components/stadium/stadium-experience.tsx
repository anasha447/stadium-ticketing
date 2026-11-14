"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { api, isProblem, PROBLEM } from "@/lib/api";
import {
  addSeat,
  type ChosenSeat,
  isChosen,
  isFull,
  removeSeat,
  removeSeatIds,
  seatIdOf,
  seatsTogether,
} from "@/lib/booking/selection";
import type { Block, Currency, Hold, SeatCounts, SeatDelta, Tier } from "@/lib/domain/types";
import { formatCount, formatMoney, TIER_NAME, TIER_ORDER, TIER_SWATCH } from "@/lib/format";
import { useNow } from "@/lib/hooks/use-now";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { seatAtPoint, seatOnRay, type SeatRefInBlock } from "@/lib/stadium/layout";
import { applyDeltas, countSeats, takenSeats } from "@/lib/stadium/live-seats";
import {
  availableCount,
  isAvailable,
  nextAvailableRow,
  nextAvailableSeat,
  STADIUM,
  viewReducer,
} from "@/lib/stadium/view";
import { seatView } from "@/lib/stadium/view-score";
import { parseSeatId, seatOffset } from "@/lib/domain/seat-id";
import type { StandHit } from "./bowl";
import type { Heading } from "./camera-rig";
import { MiniMap } from "./mini-map";
import { YourSeats } from "./your-seats";

// The stadium a Fan moves through: the whole bowl, then a Block, then a seat.
// This component decides where the Fan is and loads what that needs; the
// canvas draws it, and the panels around it say it in words.

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

/** The one orange button: the next thing the Fan should do. */
const ACTION =
  "h-12 rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600 disabled:bg-night-800 disabled:text-flood-500";
/** A button that matters but is not the next step. */
const STRONG =
  "h-12 rounded-control border border-flood-300 px-6 font-semibold transition-colors duration-fast hover:bg-night-800 disabled:border-night-700 disabled:text-flood-500";

// The id of the Fan's Hold is kept for this tab, so a reload does not lose it.
const holdKey = (matchId: number) => `stadium.hold.${matchId}`;
function readHoldId(matchId: number): string | null {
  try {
    return window.sessionStorage.getItem(holdKey(matchId));
  } catch {
    return null;
  }
}
function saveHoldId(matchId: number, holdId: string | null) {
  try {
    if (holdId) window.sessionStorage.setItem(holdKey(matchId), holdId);
    else window.sessionStorage.removeItem(holdKey(matchId));
  } catch {
    // Without storage the Hold simply does not survive a reload.
  }
}

/** The seats of a Hold, as places in the stadium. */
const seatsOf = (hold: Hold): ChosenSeat[] =>
  hold.seatIds.flatMap((seatId) => parseSeatId(seatId) ?? []);

/** "Block 107 row 03 seat 05", for messages. */
function seatWords(seatId: string): string {
  const seat = parseSeatId(seatId);
  return seat ? `Block ${seat.blockId} row ${pad(seat.row)} seat ${pad(seat.seat)}` : seatId;
}

const STATE_WORD: Record<string, string> = { A: "Available", H: "Held", S: "Sold" };

/** Says which chosen seats someone else got to first. */
function takenNotice(taken: string[], stillChosen: number): string {
  const seats = `Taken while you were choosing: ${taken.map(seatWords).join(", ")}.`;
  return stillChosen > 0 ? `${seats} Your other seats are still chosen.` : seats;
}

/** Seat changes can come many times a second; the page takes them in this often. */
const TAKE_IN_EVERY_MS = 400;
/** How long a seat change is remembered, to patch a snapshot that was on its way. */
const REMEMBER_MS = 30_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** What the pointer is over: a whole Block, or one seat of the open Block. */
type Hover =
  | { kind: "block"; blockId: string }
  | { kind: "seat"; blockId: string; row: number; seat: number };

const sameHover = (a: Hover | null, b: Hover | null) =>
  a?.kind === b?.kind &&
  a?.blockId === b?.blockId &&
  (a?.kind !== "seat" || b?.kind !== "seat" || (a.row === b.row && a.seat === b.seat));

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
  /** Seat States by Block id: read when the Match stream opens, then kept up to date by it. */
  const [states, setStates] = useState<Record<string, string>>({});
  /** The seat changes of the last half minute, newest last. */
  const recent = useRef<{ at: number; delta: SeatDelta }[]>([]);
  /** With reduced motion the match stands still until the Fan starts it. */
  const [matchStarted, setMatchStarted] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [shownTier, setShownTier] = useState<Tier | null>(null);
  const heading = useRef<Heading>({ x: 0, z: 0 });
  const card = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const now = useNow();
  /** Seats chosen but not held yet. */
  const [chosen, setChosen] = useState<ChosenSeat[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** On a phone the drawer covers the panel, so it opens only when asked. */
  const [drawerOpen, setDrawerOpen] = useState(false);

  const blockId = view.kind === "stadium" ? null : view.blockId;
  const block = blockId ? blocks.find((b) => b.id === blockId) : undefined;
  const blockStates = blockId ? states[blockId] : undefined;

  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  /** Seats left in every Block, for the hover card. */
  const counts = useMemo(() => countSeats(states), [states]);

  /**
   * Reads Seat States, of every Block or of some, and puts them in place.
   * A change that arrived while the answer was on its way may be missing
   * from it, so those are applied again on top.
   */
  const readStates = useCallback(
    (blockIds?: string[]) => {
      const asked = Date.now();
      return api.getSeatStates(matchId, blockIds).then((result) => {
        const since = recent.current.filter((seen) => seen.at >= asked).map((seen) => seen.delta);
        setStates((known) => applyDeltas({ ...known, ...result.blocks }, since, blockById));
      });
    },
    [matchId, blockById],
  );

  // A Hold outlives a reload: read it back if this tab made one.
  useEffect(() => {
    const holdId = readHoldId(matchId);
    if (!holdId) return;
    let cancelled = false;
    api
      .getHold(matchId, holdId)
      .then((kept) => {
        if (cancelled) return;
        setHold(kept);
        setChosen(seatsOf(kept));
      })
      .catch(() => saveHoldId(matchId, null));
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  /** Reads the Seat States of these Blocks again, after a Hold changed them. */
  const refresh = useCallback(
    (blockIds: string[]) => {
      const ids = [...new Set(blockIds)];
      if (ids.length > 0) readStates(ids).catch(() => {});
    },
    [readStates],
  );

  const takeIn = useEffectEvent((batch: SeatDelta[]) => {
    setStates((known) => applyDeltas(known, batch, blockById));
    // A seat this Fan has chosen but does not hold yet can go to someone
    // else. While a Hold is being made, its answer says so instead.
    if (hold || busy) return;
    const taken = takenSeats(batch, chosen.map(seatIdOf));
    if (taken.length === 0) return;
    setChosen((list) => removeSeatIds(list, taken));
    setNotice(takenNotice(taken, chosen.length - taken.length));
  });

  // The Match stream. Opening it (and every time it comes back) is the cue
  // to read the whole stadium's Seat States; after that it sends changes.
  useEffect(() => {
    let waiting: SeatDelta[] = [];
    const stop = api.watchSeats(matchId, {
      onOpen: () => {
        // If this fails the stands stay empty, and a Block is read when it is opened.
        readStates().catch(() => {});
      },
      onDelta: (delta) => {
        recent.current.push({ at: Date.now(), delta });
        waiting.push(delta);
      },
    });
    const timer = setInterval(() => {
      const oldest = Date.now() - REMEMBER_MS;
      recent.current = recent.current.filter((seen) => seen.at >= oldest);
      if (waiting.length === 0) return;
      const batch = waiting;
      waiting = [];
      takeIn(batch);
    }, TAKE_IN_EVERY_MS);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [matchId, readStates]);

  // The stream's first read covers every Block. A Block opened before that
  // has arrived, or after it failed, is read by itself.
  useEffect(() => {
    if (!blockId || blockStates !== undefined) return;
    let cancelled = false;
    readStates([blockId])
      .then(() => {
        if (!cancelled) setFailed(null);
      })
      .catch(() => {
        if (!cancelled) setFailed(blockId);
      });
    return () => {
      cancelled = true;
    };
  }, [blockId, blockStates, readStates]);

  const open = useMemo(
    () => (blockId && blockStates ? { blockId, states: blockStates } : null),
    [blockId, blockStates],
  );

  /** The Fan's own seats: the ones in their Hold, or the ones chosen so far. */
  const mine = useMemo(() => (hold ? seatsOf(hold) : chosen), [hold, chosen]);

  /** The seat a pointer on the stands is aimed at. */
  const aimedAt = useCallback(
    (hit: StandHit): SeatRefInBlock | null => {
      const guess = seatAtPoint(blocks, hit.point[0], hit.point[2]);
      return guess && seatOnRay(guess, hit.origin, hit.direction);
    },
    [blocks],
  );

  const handleStandClick = useCallback(
    (hit: StandHit) => {
      const aimed = aimedAt(hit);
      if (!aimed) return;
      setHover(null);
      // A click on another Block always goes to that Block.
      if (aimed.block.id !== blockId) {
        dispatch({ type: "openBlock", blockId: aimed.block.id });
        return;
      }
      // In the open Block, only an available seat can be sat in, or one of the Fan's own.
      const own = isChosen(mine, { blockId: aimed.block.id, row: aimed.row, seat: aimed.seat });
      if (own || (blockStates && isAvailable(aimed.block, blockStates, aimed.row, aimed.seat))) {
        dispatch({ type: "sit", blockId: aimed.block.id, row: aimed.row, seat: aimed.seat });
      }
    },
    [aimedAt, blockId, blockStates, mine],
  );

  const viewKind = view.kind;
  const handleStandHover = useCallback(
    (hit: StandHit | null) => {
      const aimed = hit && viewKind !== "seat" ? aimedAt(hit) : null;
      const next: Hover | null = !aimed
        ? null
        : aimed.block.id === blockId
          ? { kind: "seat", blockId: aimed.block.id, row: aimed.row, seat: aimed.seat }
          : { kind: "block", blockId: aimed.block.id };
      // The pointer moves constantly; only tell React when the target changes.
      setHover((current) => (sameHover(current, next) ? current : next));
      // The card follows the pointer without going through React at all.
      if (hit && card.current) {
        const x = Math.min(hit.clientX + 18, window.innerWidth - 240);
        const y = Math.min(hit.clientY + 18, window.innerHeight - 150);
        card.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    },
    [aimedAt, blockId, viewKind],
  );

  const handleMapHover = useCallback((id: string | null) => {
    setHover(id ? { kind: "block", blockId: id } : null);
  }, []);

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

  const current: ChosenSeat | null =
    view.kind === "seat" ? { blockId: view.blockId, row: view.row, seat: view.seat } : null;

  const addCurrent = () => {
    if (!current) return;
    setChosen((list) => addSeat(list, current));
    setNotice(null);
  };

  const pickTogether = (count: number) => {
    if (!block || !blockStates) return;
    const picked = seatsTogether(block, blockStates, count);
    if (picked) {
      setChosen(picked);
      setNotice(null);
      setDrawerOpen(true);
    } else {
      setNotice(`Block ${block.id} has no ${count} available seats together. Try another Block.`);
      setChosen([]);
      setDrawerOpen(true);
    }
  };

  const holdSeats = () => {
    setBusy(true);
    setNotice(null);
    const blockIds = chosen.map((seat) => seat.blockId);
    api
      .createHold(matchId, { mode: "EXPLICIT", seatIds: chosen.map(seatIdOf) })
      .then((made) => {
        setHold(made);
        saveHoldId(matchId, made.holdId);
        refresh(blockIds);
      })
      .catch((error: unknown) => {
        if (isProblem(error, PROBLEM.seatsUnavailable)) {
          // Name the seats that went, drop them, keep the rest chosen.
          const taken = error.conflictingSeatIds;
          setChosen((list) => removeSeatIds(list, taken));
          setNotice(takenNotice(taken, chosen.length - taken.length));
          refresh(blockIds);
        } else if (isProblem(error, PROBLEM.purchaseLimit)) {
          setNotice(error.detail ?? "You can have four seats for one Match.");
        } else if (isProblem(error, PROBLEM.notAdmitted)) {
          router.replace(`/matches/${matchId}/waiting-room`);
        } else {
          setNotice("Your seats could not be held just now. Try again.");
        }
      })
      .finally(() => setBusy(false));
  };

  /** Gives the Hold up, or clears one that ran out. The seats stay chosen. */
  const letGo = (release: boolean) => {
    if (!hold) return;
    const blockIds = seatsOf(hold).map((seat) => seat.blockId);
    const done = () => {
      setHold(null);
      saveHoldId(matchId, null);
      setNotice(null);
      refresh(blockIds);
    };
    if (!release) return done();
    setBusy(true);
    api
      .releaseHold(matchId, hold.holdId)
      .catch(() => {
        // Already gone on the backend, which is what was wanted.
      })
      .finally(() => {
        setBusy(false);
        done();
      });
  };

  const seated = view.kind === "seat" && block ? seatView(block, view.row, view.seat) : null;
  /** True when someone else took the seat the Fan is sitting in to look. */
  const currentTaken =
    current !== null &&
    block !== undefined &&
    blockStates !== undefined &&
    !isChosen(mine, current) &&
    blockStates[seatOffset(block, current.row, current.seat)] !== "A";
  const litBlockId = hover?.kind === "block" ? hover.blockId : null;
  const tierPrice = useMemo(() => {
    const price = {} as Record<Tier, string>;
    for (const b of blocks) price[b.tier] = b.basePrice;
    return price;
  }, [blocks]);

  return (
    <>
      <div className={`absolute inset-0 ${hover ? "cursor-pointer" : "cursor-grab"}`}>
        <StadiumCanvas
          blocks={blocks}
          view={view}
          open={open}
          sold={states}
          litBlockId={litBlockId}
          shownTier={shownTier}
          mine={mine}
          matchPlaying={!reducedMotion || matchStarted}
          reducedMotion={reducedMotion}
          heading={heading}
          onStandClick={handleStandClick}
          onStandHover={handleStandHover}
        />
      </div>

      {/* Where the Fan is, and what they can do there. A sheet at the bottom on a phone. */}
      <section
        aria-live="polite"
        className="glass absolute inset-x-4 bottom-4 flex flex-col gap-3 px-4 py-4 sm:inset-x-auto sm:bottom-auto sm:left-8 sm:top-4 sm:w-80"
      >
        <nav aria-label="Where you are">
          <ol className="flex flex-wrap items-center gap-x-2 text-sm text-flood-300">
            <li>
              {view.kind === "stadium" ? (
                <span aria-current="page" className="text-flood-50">Stadium</span>
              ) : (
                <button type="button" className="underline-offset-4 hover:text-flood-50 hover:underline" onClick={() => dispatch({ type: "stadium" })}>
                  Stadium
                </button>
              )}
            </li>
            {block && (
              <li className="flex items-center gap-x-2">
                <span aria-hidden>/</span>
                {view.kind === "block" ? (
                  <span aria-current="page" className="text-flood-50">Block {block.id}</span>
                ) : (
                  <button type="button" className="underline-offset-4 hover:text-flood-50 hover:underline" onClick={() => dispatch({ type: "back" })}>
                    Block {block.id}
                  </button>
                )}
              </li>
            )}
            {view.kind === "seat" && (
              <li className="flex items-center gap-x-2">
                <span aria-hidden>/</span>
                <span aria-current="page" className="text-flood-50">
                  Row {pad(view.row)}, seat {pad(view.seat)}
                </span>
              </li>
            )}
          </ol>
        </nav>

        {view.kind === "stadium" && (
          <>
            <h1 className="display text-2xl">{title}</h1>
            <p className="text-sm text-flood-300">
              Click a Block to fly in. Drag to spin the stadium, scroll or pinch
              to zoom.
            </p>
            {reducedMotion && (
              <button
                type="button"
                className={STRONG}
                aria-pressed={matchStarted}
                onClick={() => setMatchStarted((on) => !on)}
              >
                {matchStarted ? "Pause the match" : "Play the match"}
              </button>
            )}
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
                {blockStates && !hold && (
                  <div className="flex items-center gap-2 text-sm text-flood-300">
                    <span className="flex-1">Pick seats together</span>
                    {[2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        aria-label={`Pick ${count} seats together`}
                        className="data size-9 rounded-control border border-night-700 text-flood-50 transition-colors duration-fast hover:bg-night-800"
                        onClick={() => pickTogether(count)}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {view.kind === "seat" && seated && (
              <>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
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
                  <div>
                    <dt className="text-flood-300">View</dt>
                    <dd className="data text-lg">
                      {seated.score}
                      <span className="text-sm text-flood-300"> of 100</span>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-flood-300">To the pitch</dt>
                    <dd className="data text-lg">
                      {seated.toPitch}
                      <span className="text-sm text-flood-300"> m</span>
                    </dd>
                  </div>
                </dl>
                {current && hold && (
                  <p className="text-sm text-flood-300">
                    {isChosen(mine, current)
                      ? "This seat is held for you."
                      : "Your seats are held. Release them to choose different ones."}
                  </p>
                )}
                {current && !hold && isChosen(chosen, current) && (
                  <button
                    type="button"
                    className={QUIET_BUTTON}
                    onClick={() => setChosen((list) => removeSeat(list, current))}
                  >
                    Remove from your seats
                  </button>
                )}
                {currentTaken && !hold && (
                  <p className="text-sm text-flood-300">
                    Another Fan has just taken this seat. The buttons below go
                    to the nearest available ones.
                  </p>
                )}
                {current && !hold && !currentTaken && !isChosen(chosen, current) && (
                  <>
                    <button
                      type="button"
                      // Orange until something is chosen; after that "Hold seats" is the next step.
                      className={chosen.length === 0 ? ACTION : STRONG}
                      disabled={isFull(chosen)}
                      onClick={addCurrent}
                    >
                      Add seat
                    </button>
                    {isFull(chosen) && (
                      <p className="text-xs text-flood-500">
                        You have four seats, the most for one Match.
                      </p>
                    )}
                  </>
                )}
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
                <p className="hidden text-xs text-flood-500 sm:block">
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

        {mine.length > 0 && (
          <button
            type="button"
            className={`${QUIET_BUTTON} sm:hidden`}
            onClick={() => setDrawerOpen(true)}
          >
            Your seats ({mine.length})
          </button>
        )}
      </section>

      {(mine.length > 0 || notice) && (
        <YourSeats
          blocks={blocks}
          currency={currency}
          chosen={chosen}
          hold={hold}
          now={now}
          busy={busy}
          notice={notice}
          checkoutHref={hold ? `/matches/${matchId}/checkout/${hold.holdId}` : null}
          shown={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onView={(seat) => {
            dispatch({ type: "sit", ...seat });
            setDrawerOpen(false);
          }}
          onRemove={(seat) => setChosen((list) => removeSeat(list, seat))}
          onHold={holdSeats}
          onRelease={() => letGo(true)}
          onStartAgain={() => letGo(false)}
        />
      )}

      {/* The four Tiers. Pressing one dims every Block of the other Tiers. */}
      <section
        aria-label="Tiers and prices"
        className="glass absolute left-4 top-4 px-2 py-2 sm:bottom-4 sm:left-8 sm:top-auto sm:w-80 sm:px-3 sm:py-3"
      >
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-1">
          {TIER_ORDER.map((tier) => (
            <li key={tier}>
              <button
                type="button"
                aria-pressed={shownTier === tier}
                onClick={() => setShownTier((current) => (current === tier ? null : tier))}
                className={`flex h-9 w-full items-center gap-2 rounded-control px-2 text-left text-sm transition-colors duration-fast hover:bg-night-800 ${
                  shownTier === tier ? "bg-night-800 text-flood-50" : "text-flood-300"
                }`}
              >
                <span className={`size-3 shrink-0 ${TIER_SWATCH[tier]}`} aria-hidden />
                <span className="hidden flex-1 sm:inline">{TIER_NAME[tier]}</span>
                <span className="data">{formatMoney(tierPrice[tier], currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass absolute right-4 top-4 h-28 w-24 p-1.5 sm:bottom-4 sm:right-8 sm:top-auto sm:h-56 sm:w-48 sm:p-3">
        <MiniMap
          blocks={blocks}
          view={view}
          litBlockId={litBlockId}
          shownTier={shownTier}
          heading={heading}
          onOpenBlock={(id) => dispatch({ type: "openBlock", blockId: id })}
          onHoverBlock={handleMapHover}
        />
      </section>

      {/* The card beside the pointer. It is always in the page so it can be
          moved without React; it is only shown while something is hovered. */}
      <div
        ref={card}
        role="tooltip"
        className={`glass pointer-events-none fixed left-0 top-0 z-10 w-56 px-3 py-2 text-sm transition-opacity duration-fast ${
          hover ? "opacity-100" : "opacity-0"
        }`}
      >
        <HoverCard
          hover={hover}
          blocks={blocks}
          counts={counts}
          states={states}
          currency={currency}
        />
      </div>
    </>
  );
}

function HoverCard({
  hover,
  blocks,
  counts,
  states,
  currency,
}: {
  hover: Hover | null;
  blocks: Block[];
  counts: Record<string, SeatCounts>;
  states: Record<string, string>;
  currency: Currency;
}) {
  const block = hover && blocks.find((b) => b.id === hover.blockId);
  if (!hover || !block) return null;
  const price = formatMoney(block.basePrice, currency);

  if (hover.kind === "block") {
    const left = counts[block.id]?.available;
    return (
      <>
        <p className="display text-xl">Block {block.id}</p>
        <p className="text-flood-300">
          {TIER_NAME[block.tier]}, <span className="data text-flood-50">{price}</span>
        </p>
        {left !== undefined && (
          <p className="text-flood-300">
            <span className="data text-flood-50">{formatCount(left)}</span> seats left
          </p>
        )}
      </>
    );
  }

  const state = states[block.id]?.[seatOffset(block, hover.row, hover.seat)];
  const { score } = seatView(block, hover.row, hover.seat);
  return (
    <>
      <p className="font-semibold">
        Row {pad(hover.row)}, seat {pad(hover.seat)}
      </p>
      <p className="text-flood-300">
        {state ? `${STATE_WORD[state]}, ` : ""}
        <span className="data text-flood-50">{price}</span>
      </p>
      <p className="text-flood-300">
        View <span className="data text-flood-50">{score}</span> of 100
      </p>
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
