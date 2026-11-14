"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { COLOR } from "@/lib/design/tokens";
import type { Block, Level } from "@/lib/domain/types";
import { STADIUM_FOV } from "@/lib/stadium/camera";
import type { View } from "@/lib/stadium/view";
import { Bowl, type StandClick } from "./bowl";
import { CameraRig } from "./camera-rig";
import { Pitch } from "./pitch";
import { type OpenBlock, Seats } from "./seats";

// The 3D scene. It draws what it is told: which view the camera should be
// in and which Block is open. Deciding those is StadiumExperience's job.

export default function StadiumCanvas({
  blocks,
  view,
  open,
  reducedMotion,
  onStandClick,
}: {
  blocks: Block[];
  view: View;
  open: OpenBlock | null;
  reducedMotion: boolean;
  onStandClick: (click: StandClick) => void;
}) {
  // The terraces have one step per Row, so they need the Row count per Level.
  const rows = useMemo(() => {
    const count = {} as Record<Level, number>;
    for (const block of blocks) count[block.level] = block.rowSeats.length;
    return count;
  }, [blocks]);

  return (
    <Canvas
      camera={{ fov: STADIUM_FOV, near: 1, far: 4000 }}
      dpr={[1, 2]}
      aria-label="The stadium in 3D"
      role="img"
    >
      <color attach="background" args={[COLOR.night950]} />

      {/* Night: a dim sky, and floodlights from the four corners of the roof. */}
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
      <Bowl rows={rows} onStandClick={onStandClick} />
      <Seats blocks={blocks} open={open} reducedMotion={reducedMotion} />

      {/* The ground outside the stadium. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[900, 64]} />
        <meshStandardMaterial color={COLOR.night900} roughness={1} />
      </mesh>

      <CameraRig view={view} blocks={blocks} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
