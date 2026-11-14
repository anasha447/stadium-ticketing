"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import type { ChosenSeat } from "@/lib/booking/selection";
import { COLOR } from "@/lib/design/tokens";
import type { Block, Level, Tier } from "@/lib/domain/types";
import { STADIUM_FOV } from "@/lib/stadium/camera";
import { seatPlace } from "@/lib/stadium/layout";
import { buildSeats } from "@/lib/stadium/seats";
import type { View } from "@/lib/stadium/view";
import { Bowl, type StandHit } from "./bowl";
import { CameraRig, type Heading } from "./camera-rig";
import { Fans } from "./fans";
import { MatchPlay } from "./match-play";
import { Floodlights, Sky } from "./night";
import { Pitch } from "./pitch";
import { type OpenBlock, Seats } from "./seats";

// The 3D scene. It draws what it is told: which view the camera should be
// in and which Block is open. Deciding those is StadiumExperience's job.

export default function StadiumCanvas({
  blocks,
  view,
  open,
  sold,
  litBlockId,
  shownTier,
  mine,
  matchPlaying,
  reducedMotion,
  heading,
  onStandClick,
  onStandHover,
}: {
  blocks: Block[];
  view: View;
  open: OpenBlock | null;
  /** Seat States of every Block known so far, for the fans on sold seats. */
  sold: Record<string, string>;
  litBlockId: string | null;
  shownTier: Tier | null;
  mine: ChosenSeat[];
  /** False holds the match on the pitch still. */
  matchPlaying: boolean;
  reducedMotion: boolean;
  heading: { current: Heading };
  onStandClick: (hit: StandHit) => void;
  onStandHover: (hit: StandHit | null) => void;
}) {
  // The terraces have one step per Row, so they need the Row count per Level.
  const rows = useMemo(() => {
    const count = {} as Record<Level, number>;
    for (const block of blocks) count[block.level] = block.rowSeats.length;
    return count;
  }, [blocks]);

  // Seats and fans share one layout, so it is worked out once here.
  const seats = useMemo(() => buildSeats(blocks), [blocks]);

  /** Where the Fan is sitting, in seat view. */
  const sittingAt = useMemo((): [number, number, number] | null => {
    if (view.kind !== "seat") return null;
    const block = blocks.find((b) => b.id === view.blockId);
    if (!block) return null;
    const { x, y, z } = seatPlace(block, view.row, view.seat);
    return [x, y, z];
  }, [blocks, view]);

  return (
    <Canvas
      camera={{ fov: STADIUM_FOV, near: 1, far: 4000 }}
      dpr={[1, 2]}
      aria-label="The stadium in 3D"
      role="img"
    >
      <color attach="background" args={[COLOR.night950]} />

      <Sky />

      {/* The light itself: a dim sky, and four lights high over the corners
          standing in for the floodlights round the roof. */}
      <hemisphereLight args={[COLOR.sceneRoof, COLOR.night950, 0.7]} />
      {[
        [120, 150, 150],
        [-120, 150, 150],
        [120, 150, -150],
        [-120, 150, -150],
      ].map(([x, y, z]) => (
        <directionalLight key={`${x},${z}`} position={[x, y, z]} intensity={0.75} />
      ))}

      <Pitch />
      <MatchPlay playing={matchPlaying} />
      <Bowl rows={rows} onStandClick={onStandClick} onStandHover={onStandHover} />
      <Floodlights />
      <Seats
        blocks={blocks}
        seats={seats}
        open={open}
        litBlockId={litBlockId}
        shownTier={shownTier}
        mine={mine}
        reducedMotion={reducedMotion}
      />
      {/* The stadium view keeps the mosaic clear: fans come in with a Block. */}
      <Fans
        blocks={blocks}
        seats={seats}
        states={sold}
        openBlockId={view.kind === "stadium" ? null : view.blockId}
        sittingAt={sittingAt}
        reducedMotion={reducedMotion}
      />

      {/* The ground outside the stadium. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[900, 64]} />
        <meshStandardMaterial color={COLOR.night900} roughness={1} />
      </mesh>

      <CameraRig view={view} blocks={blocks} reducedMotion={reducedMotion} heading={heading} />
    </Canvas>
  );
}
