"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Block, Tier } from "@/lib/domain/types";
import { PITCH, seatPlace } from "@/lib/stadium/layout";
import { TIER_NAME } from "@/lib/format";
import { blockOutline, MAP_BOUNDS, type MapKey, mapStep } from "@/lib/stadium/minimap";
import type { View } from "@/lib/stadium/view";
import type { Heading } from "./camera-rig";

// The stadium from straight above, north at the top. Every Block is a
// shape you can press to fly there. Once you are seated it marks your seat
// and the way you are looking.
//
// From the keyboard the map is one stop in the Tab order. Arrow keys move
// round the ring and between Levels, and Enter or Space flies to the Block.

const TIER_FILL: Record<Tier, string> = {
  CLUB_PREMIUM: "fill-tier-premium",
  CATEGORY_1: "fill-tier-1",
  CATEGORY_2: "fill-tier-2",
  CATEGORY_3: "fill-tier-3",
};

const { halfWidth, halfHeight } = MAP_BOUNDS;

export function MiniMap({
  blocks,
  view,
  litBlockId,
  shownTier,
  heading,
  onOpenBlock,
  onHoverBlock,
  onFocusBlock,
}: {
  blocks: Block[];
  view: View;
  litBlockId: string | null;
  shownTier: Tier | null;
  heading: { current: Heading };
  onOpenBlock: (blockId: string) => void;
  onHoverBlock: (blockId: string | null) => void;
  /** The Block the keyboard is on, or null when the map loses focus. */
  onFocusBlock: (blockId: string | null) => void;
}) {
  const outlines = useMemo(
    () => blocks.map((block) => ({ block, path: blockOutline(block) })),
    [blocks],
  );
  const openId = view.kind === "stadium" ? null : view.blockId;

  // Only one Block is in the Tab order at a time: the last one the keyboard
  // was on, else the open one, else the first.
  const [keyed, setKeyed] = useState<string | null>(null);
  const tabStop = keyed ?? openId ?? blocks[0]?.id;
  const paths = useRef(new Map<string, SVGPathElement>());

  const onKey = (event: KeyboardEvent<SVGPathElement>, blockId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenBlock(blockId);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    // The arrow keys also move between seats; here they belong to the map.
    event.preventDefault();
    event.stopPropagation();
    const next = mapStep(blocks, blockId, event.key as MapKey);
    setKeyed(next);
    paths.current.get(next)?.focus();
  };

  const seat = useMemo(() => {
    if (view.kind !== "seat") return null;
    const block = blocks.find((b) => b.id === view.blockId);
    return block ? seatPlace(block, view.row, view.seat) : null;
  }, [view, blocks]);

  // The look direction changes every frame while the Fan drags, so it is
  // written straight to the SVG and never goes through React.
  const cone = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!seat) return;
    let frame = 0;
    const turn = () => {
      const { x, z } = heading.current;
      const degrees = (Math.atan2(z, x) * 180) / Math.PI;
      cone.current?.setAttribute("transform", `translate(${seat.x} ${seat.z}) rotate(${degrees})`);
      frame = requestAnimationFrame(turn);
    };
    frame = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(frame);
  }, [seat, heading]);

  return (
    <svg
      viewBox={`${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`}
      className="h-full w-full"
      role="group"
      aria-label="Map of the stadium from above. Press a Block to go to it, or use the arrow keys and Enter."
      onPointerLeave={() => onHoverBlock(null)}
    >
      <rect
        x={-PITCH.width / 2}
        y={-PITCH.length / 2}
        width={PITCH.width}
        height={PITCH.length}
        className="fill-scene-turf-dark"
      />

      {outlines.map(({ block, path }) => {
        const isOpen = block.id === openId;
        const dimmed = shownTier !== null && block.tier !== shownTier;
        const lit = block.id === litBlockId;
        return (
          <path
            key={block.id}
            d={path}
            ref={(node) => {
              if (node) paths.current.set(block.id, node);
              else paths.current.delete(block.id);
            }}
            role="button"
            tabIndex={block.id === tabStop ? 0 : -1}
            aria-label={`Block ${block.id}, ${TIER_NAME[block.tier]}`}
            aria-current={isOpen ? "location" : undefined}
            strokeWidth={2}
            className={`cursor-pointer outline-none transition-opacity duration-fast focus-visible:stroke-flood-50 ${
              isOpen ? "fill-flood-50" : TIER_FILL[block.tier]
            }`}
            opacity={isOpen || lit ? 1 : dimmed ? 0.12 : 0.55}
            onClick={() => onOpenBlock(block.id)}
            onPointerEnter={() => onHoverBlock(block.id)}
            onKeyDown={(event) => onKey(event, block.id)}
            onFocus={() => {
              setKeyed(block.id);
              onFocusBlock(block.id);
            }}
            onBlur={() => onFocusBlock(null)}
          >
            <title>{`Block ${block.id}`}</title>
          </path>
        );
      })}

      {seat && (
        <>
          {/* A wedge for the field of view, turned to face where the Fan looks. */}
          <path
            ref={cone}
            d="M0 0 L46 -22 A51 51 0 0 1 46 22 Z"
            className="pointer-events-none fill-state-mine"
            opacity={0.35}
          />
          <circle cx={seat.x} cy={seat.z} r={5} className="pointer-events-none fill-state-mine" />
        </>
      )}
    </svg>
  );
}
