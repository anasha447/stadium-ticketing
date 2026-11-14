"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  InstancedBufferAttribute,
  type InstancedMesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COLOR, type ColorToken } from "@/lib/design/tokens";
import type { ChosenSeat } from "@/lib/booking/selection";
import { blockSeatCount, seatOffset } from "@/lib/domain/seat-id";
import type { Block, Tier } from "@/lib/domain/types";
import { SEAT_COLOURS, type SeatInstances } from "@/lib/stadium/seats";

// Every seat in the stadium, drawn as one instanced mesh: the seat shape is
// sent to the graphics card once and repeated 60,000 times, each copy with
// its own place and colour. That is what keeps it smooth.
//
// A Block's seats have one of two looks. Normally they show the mosaic. The
// Block the Fan has opened shows Seat State instead: available in its Tier
// colour, held in amber, sold in grey. On top of either look a Block can be
// lit (the pointer is over it) or dimmed (the legend is showing another Tier).
// The Fan's own seats, chosen or held, are always shown in the "yours" colour.

const TIER_COLOUR: Record<Tier, ColorToken> = {
  CLUB_PREMIUM: "tierPremium",
  CATEGORY_1: "tier1",
  CATEGORY_2: "tier2",
  CATEGORY_3: "tier3",
};

/** How long a Block takes to change between the mosaic and Seat State, or to dim. */
const FADE_SECONDS = 0.3;
/** Lighting up under the pointer is feedback, so it is quicker. */
const LIGHT_SECONDS = 0.12;

/** How much of its colour a dimmed Block keeps. */
const DIMMED = 0.2;
/** How far a lit Block moves towards white. */
const LIT = 0.3;

export interface OpenBlock {
  blockId: string;
  /** One character per seat: A, H or S. */
  states: string;
}

interface Fade {
  /** Index of the Block's first colour value. */
  start: number;
  from: Float32Array;
  to: Float32Array;
  elapsed: number;
  seconds: number;
}

/** Moves every fade on by `delta` seconds, writes the colours, and returns the fades still running. */
function stepFades(fades: Fade[], attribute: InstancedBufferAttribute, delta: number): Fade[] {
  const colours = attribute.array as Float32Array;
  attribute.needsUpdate = true;
  for (const fade of fades) {
    fade.elapsed += delta;
    const k = Math.min(1, fade.elapsed / fade.seconds);
    for (let i = 0; i < fade.to.length; i++) {
      colours[fade.start + i] = fade.from[i] + (fade.to[i] - fade.from[i]) * k;
    }
  }
  return fades.filter((fade) => fade.elapsed < fade.seconds);
}

/** One seat: a pan and a backrest. Its front faces +z, its feet are at y = 0. */
function seatShape() {
  const pan = new BoxGeometry(0.44, 0.07, 0.4).translate(0, 0.42, 0.04);
  const back = new BoxGeometry(0.44, 0.44, 0.06).translate(0, 0.66, -0.19);
  return mergeGeometries([pan, back]);
}

export function Seats({
  blocks,
  seats,
  open,
  litBlockId,
  shownTier,
  mine,
  reducedMotion,
}: {
  blocks: Block[];
  /** Where every seat is, and its mosaic colour. */
  seats: SeatInstances;
  open: OpenBlock | null;
  /** The Fan's own seats: chosen, or in their Hold. */
  mine: ChosenSeat[];
  /** The Block under the pointer, if any. */
  litBlockId: string | null;
  /** When set, Blocks of every other Tier are dimmed. */
  shownTier: Tier | null;
  reducedMotion: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const shape = useMemo(() => seatShape(), []);
  /** The mosaic colour of every seat, kept so a Block can go back to it. */
  const mosaic = useRef(new Float32Array(0));
  const fades = useRef<Fade[]>([]);
  /** What each Block currently looks like, so only Blocks that change are redrawn. */
  const looks = useRef(new Map<string, string>());

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;

    instanced.instanceMatrix.array.set(seats.matrices);
    instanced.instanceMatrix.needsUpdate = true;

    // Three.js lights in linear colour, so the tokens are converted once here.
    const palette = SEAT_COLOURS.map((name) => new Color(COLOR[name]));
    const colours = new Float32Array(seats.count * 3);
    for (let i = 0; i < seats.count; i++) {
      palette[seats.colours[i]].toArray(colours, i * 3);
    }
    mosaic.current = colours.slice();
    instanced.instanceColor = new InstancedBufferAttribute(colours, 3);
    looks.current.clear();

    // The mesh's own bounds are one seat; tell it how big the stadium is so
    // it is not hidden when that one seat leaves the view.
    instanced.computeBoundingSphere();
  }, [seats]);

  // Work out how every Block should look now, and fade the ones that changed.
  useEffect(() => {
    const colours = mesh.current?.instanceColor?.array as Float32Array | undefined;
    if (!colours) return;

    const yours = new Color(COLOR.stateMine);
    for (const block of blocks) {
      const isOpen = open?.blockId === block.id;
      const dimmed = !isOpen && shownTier !== null && block.tier !== shownTier;
      const lit = !isOpen && !dimmed && litBlockId === block.id;
      const own = mine
        .filter((seat) => seat.blockId === block.id)
        .map((seat) => seatOffset(block, seat.row, seat.seat))
        .filter((offset) => offset >= 0);
      const base = `${isOpen ? open.states : "mosaic"}|${dimmed ? "dim" : ""}|${own.join(",")}`;
      const look = `${base}|${lit ? "lit" : ""}`;
      const before = looks.current.get(block.id) ?? "mosaic|||";
      if (look === before) continue;
      looks.current.set(block.id, look);

      const start = seats.blockStart[block.id] * 3;
      const size = blockSeatCount(block);
      let to: Float32Array;
      if (isOpen) {
        const available = new Color(COLOR[TIER_COLOUR[block.tier]]);
        const held = new Color(COLOR.stateHeld);
        const sold = new Color(COLOR.stateSold);
        to = new Float32Array(size * 3);
        for (let i = 0; i < size; i++) {
          const state = open.states[i];
          (state === "A" ? available : state === "H" ? held : sold).toArray(to, i * 3);
        }
      } else {
        to = mosaic.current.slice(start, start + size * 3);
        if (dimmed) for (let i = 0; i < to.length; i++) to[i] *= DIMMED;
        if (lit) for (let i = 0; i < to.length; i++) to[i] += (1 - to[i]) * LIT;
      }
      // The Fan's own seats keep their colour whatever the Block is doing.
      for (const offset of own) yours.toArray(to, offset * 3);

      // If only the light went on or off, change quickly: it is feedback.
      const onlyLight = before.startsWith(`${base}|`);
      const seconds = onlyLight ? LIGHT_SECONDS : FADE_SECONDS;
      fades.current = fades.current.filter((fade) => fade.start !== start);
      fades.current.push({
        start,
        from: colours.slice(start, start + size * 3),
        to,
        elapsed: reducedMotion ? seconds : 0,
        seconds,
      });
    }
  }, [open, litBlockId, shownTier, mine, blocks, seats, reducedMotion]);

  useFrame((_, delta) => {
    const attribute = mesh.current?.instanceColor;
    if (!attribute || fades.current.length === 0) return;
    fades.current = stepFades(fades.current, attribute, delta);
  });

  return (
    // Clicks are worked out from the step under the seat (see Bowl), so the
    // 60,000 seats are left out of hit-testing.
    <instancedMesh ref={mesh} args={[shape, undefined, seats.count]} raycast={() => null}>
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}
