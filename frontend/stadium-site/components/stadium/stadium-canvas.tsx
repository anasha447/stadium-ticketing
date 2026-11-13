"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState, useSyncExternalStore } from "react";
import { COLOR } from "@/lib/design/tokens";
import type { Level } from "@/lib/domain/types";
import { Bowl } from "./bowl";
import { Pitch } from "./pitch";

// The 3D view. Drag to spin, scroll or pinch to zoom. It turns slowly by
// itself until the Fan touches it, and never turns by itself for Fans who
// asked their device for reduced motion.

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const FOV = 38;
/** The point the camera turns around: the middle of the pitch, a little above it. */
const TARGET: [number, number, number] = [0, 10, 0];
/** The direction the opening view looks from: the south-east, well above the roof. */
const VIEW_FROM: [number, number, number] = [0.5, 0.52, 0.7];
/** Distance at which the whole bowl fits a wide screen. */
const FIT_DISTANCE = 360;

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export default function StadiumCanvas({ rows }: { rows: Record<Level, number> }) {
  const reducedMotion = usePrefersReducedMotion();
  const [touched, setTouched] = useState(false);

  return (
    <Canvas
      camera={{ fov: FOV, near: 1, far: 4000 }}
      onCreated={({ camera, size }) => {
        // Start far enough back to see the whole bowl. A tall, narrow screen
        // sees less from side to side, so it starts further away.
        const distance = FIT_DISTANCE * Math.max(1, 1.3 / (size.width / size.height));
        camera.position.set(...VIEW_FROM).setLength(distance);
        camera.lookAt(...TARGET);
      }}
      dpr={[1, 2]}
      aria-label="The stadium in 3D. Drag to spin it, scroll to zoom."
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
      <Bowl rows={rows} />

      {/* The ground outside the stadium. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[900, 64]} />
        <meshStandardMaterial color={COLOR.night900} roughness={1} />
      </mesh>

      <OrbitControls
        target={TARGET}
        enablePan={false}
        enableDamping
        minDistance={70}
        maxDistance={1000}
        // Stay above the ground, and never look straight up from below it.
        maxPolarAngle={Math.PI / 2 - 0.08}
        autoRotate={!touched && !reducedMotion}
        autoRotateSpeed={0.35}
        onStart={() => setTouched(true)}
      />
    </Canvas>
  );
}
