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
import { blockSeatCount } from "@/lib/domain/seat-id";
import type { Block, Tier } from "@/lib/domain/types";
import { buildSeats, SEAT_COLOURS } from "@/lib/stadium/seats";

// Every seat in the stadium, drawn as one instanced mesh: the seat shape is
// sent to the graphics card once and repeated 60,000 times, each copy with
// its own place and colour. That is what keeps it smooth.
//
// Seats have two looks. Normally they show the mosaic. The Block the Fan has
// opened shows Seat State instead: available in its Tier colour, held in
// amber, sold in grey.

const TIER_COLOUR: Record<Tier, ColorToken> = {
  CLUB_PREMIUM: "tierPremium",
  CATEGORY_1: "tier1",
  CATEGORY_2: "tier2",
  CATEGORY_3: "tier3",
};

/** How long a Block takes to change between the mosaic and Seat State. */
const FADE_SECONDS = 0.3;

export interface OpenBlock {
  blockId: string;
  /** One character per seat: A, H or S. */
  states: string;
}

interface Fade {
  start: number;
  from: Float32Array;
  to: Float32Array;
  elapsed: number;
}

/** Moves every fade on by `delta` seconds, writes the colours, and returns the fades still running. */
function stepFades(fades: Fade[], attribute: InstancedBufferAttribute, delta: number): Fade[] {
  const colours = attribute.array as Float32Array;
  attribute.needsUpdate = true;
  for (const fade of fades) {
    fade.elapsed += delta;
    const k = Math.min(1, fade.elapsed / FADE_SECONDS);
    for (let i = 0; i < fade.to.length; i++) {
      colours[fade.start + i] = fade.from[i] + (fade.to[i] - fade.from[i]) * k;
    }
  }
  return fades.filter((fade) => fade.elapsed < FADE_SECONDS);
}

/** One seat: a pan and a backrest. Its front faces +z, its feet are at y = 0. */
function seatShape() {
  const pan = new BoxGeometry(0.44, 0.07, 0.4).translate(0, 0.42, 0.04);
  const back = new BoxGeometry(0.44, 0.44, 0.06).translate(0, 0.66, -0.19);
  return mergeGeometries([pan, back]);
}

export function Seats({
  blocks,
  open,
  reducedMotion,
}: {
  blocks: Block[];
  open: OpenBlock | null;
  reducedMotion: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const shape = useMemo(() => seatShape(), []);
  const seats = useMemo(() => buildSeats(blocks), [blocks]);
  /** The mosaic colour of every seat, kept so a Block can go back to it. */
  const mosaic = useRef(new Float32Array(0));
  const fades = useRef<Fade[]>([]);
  const shown = useRef<string | null>(null);

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

    // The mesh's own bounds are one seat; tell it how big the stadium is so
    // it is not hidden when that one seat leaves the view.
    instanced.computeBoundingSphere();
  }, [seats]);

  // When the open Block changes, fade the old one back to the mosaic and the
  // new one to its Seat States.
  useEffect(() => {
    const colours = mesh.current?.instanceColor?.array as Float32Array | undefined;
    if (!colours) return;

    const fadeTo = (blockId: string, target: (from: number, size: number) => Float32Array) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const start = seats.blockStart[blockId] * 3;
      const size = blockSeatCount(block);
      fades.current.push({
        start,
        from: colours.slice(start, start + size * 3),
        to: target(start, size),
        elapsed: reducedMotion ? FADE_SECONDS : 0,
      });
    };

    if (shown.current && shown.current !== open?.blockId) {
      fadeTo(shown.current, (start, size) => mosaic.current.slice(start, start + size * 3));
    }
    if (open) {
      const block = blocks.find((b) => b.id === open.blockId);
      if (block) {
        const available = new Color(COLOR[TIER_COLOUR[block.tier]]);
        const held = new Color(COLOR.stateHeld);
        const sold = new Color(COLOR.stateSold);
        fadeTo(open.blockId, (_, size) => {
          const to = new Float32Array(size * 3);
          for (let i = 0; i < size; i++) {
            const state = open.states[i];
            (state === "A" ? available : state === "H" ? held : sold).toArray(to, i * 3);
          }
          return to;
        });
      }
    }
    shown.current = open?.blockId ?? null;
  }, [open, blocks, seats, reducedMotion]);

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
