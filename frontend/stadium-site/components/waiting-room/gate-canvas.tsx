"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import { type PerspectiveCamera, Vector3 } from "three";
import { COLOR } from "@/lib/design/tokens";
import { easeInOut } from "@/lib/stadium/camera";
import { type Arrangement, FAN_TOP, framing } from "@/lib/waiting-room/line";
import type { Walker } from "@/lib/waiting-room/walk";
import { Sky } from "../stadium/night";
import { horizonColour } from "../stadium/skyline";
import { type BoardText, GateBoard } from "./gate-board";
import { GateWorld } from "./gate-world";
import { QueueLine, startingWalker } from "./queue-line";

// The Waiting Room in 3D: the plaza outside one gate at night, the line of
// Fans, this Fan in it, and the board over the gate. It draws what it is
// told. When this Fan is let in it walks them through, pushes the camera in
// after them, and says when the camera is through the gate.

const FOV = 40;

/** How quickly the camera settles on a new framing. Higher is snappier. */
const FOLLOW = 1.6;

/** The push through the gate: how long it takes, and where it ends, inside the passage. */
const PUSH_SECONDS = 1.9;
const PUSH_TO = new Vector3(0, 2, -5);
const PUSH_LOOK = new Vector3(0, 1.8, -20);

/** This Fan starts the push once they are this close to the turnstiles. */
const PUSH_WHEN = 2.4;

/** How far through the push the camera crosses the gate, and the screen should flare. */
const THROUGH_AT = 0.55;

function GateCamera({
  fanAt,
  entering,
  reducedMotion,
  onThrough,
}: {
  fanAt: { current: Walker };
  entering: boolean;
  reducedMotion: boolean;
  onThrough: () => void;
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const look = useRef(new Vector3());
  const placed = useRef(false);
  const push = useRef<{ from: Vector3; look: Vector3; t: number } | null>(null);
  const said = useRef(false);
  const goal = useMemo(
    () => ({ position: new Vector3(), target: new Vector3() }),
    [],
  );

  useFrame((_, delta) => {
    // A slow device or a hidden tab draws few frames; up to half a second a
    // frame keeps the line in step with the real queue without jumping far.
    const dt = Math.min(delta, 0.5);
    const fan = fanAt.current;

    if (entering && reducedMotion) {
      // No walk and no push: say so at once, and the screen fades.
      if (!said.current) {
        said.current = true;
        onThrough();
      }
      return;
    }

    if (entering && !push.current && fan.z < PUSH_WHEN) {
      push.current = {
        from: camera.position.clone(),
        look: look.current.clone(),
        t: 0,
      };
    }

    if (push.current) {
      const p = push.current;
      p.t = Math.min(1, p.t + dt / PUSH_SECONDS);
      const k = easeInOut(p.t);
      camera.position.lerpVectors(p.from, PUSH_TO, k);
      look.current.lerpVectors(p.look, PUSH_LOOK, k);
      camera.lookAt(look.current);
      if (p.t >= THROUGH_AT && !said.current) {
        said.current = true;
        onThrough();
      }
      return;
    }

    const { position, target } = framing(
      fan,
      size.width / Math.max(1, size.height),
      FOV,
    );
    goal.position.set(...position);
    goal.target.set(...target);
    if (!placed.current || reducedMotion) {
      camera.position.copy(goal.position);
      look.current.copy(goal.target);
      placed.current = true;
    } else {
      const ease = 1 - Math.exp(-FOLLOW * dt);
      camera.position.lerp(goal.position, ease);
      look.current.lerp(goal.target, ease);
    }
    camera.lookAt(look.current);
  });

  return null;
}

/**
 * Keeps the marker over this Fan's head. The marker is ordinary page text,
 * so it is sharp and in the site's own type; each frame it is moved to where
 * the head lands on screen. It hides once the Fan has gone into the gate.
 */
function MarkerFollower({
  fanAt,
  markerRef,
}: {
  fanAt: { current: Walker };
  markerRef: RefObject<HTMLParagraphElement | null>;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const element = markerRef.current;
    if (!element) return;
    const fan = fanAt.current;
    point.set(fan.x, FAN_TOP - 0.5, fan.z).project(camera);
    const x = ((point.x + 1) / 2) * size.width;
    const y = ((1 - point.y) / 2) * size.height;
    element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    element.style.opacity = fan.z < 1 || point.z > 1 ? "0" : "1";
  });
  return null;
}

export default function GateCanvas({
  arrangement,
  entering,
  reducedMotion,
  board,
  marker,
  onThrough,
}: {
  arrangement: Arrangement;
  entering: boolean;
  reducedMotion: boolean;
  board: BoardText;
  marker: string;
  /** Called once, when the camera has gone through the gate after this Fan. */
  onThrough: () => void;
}) {
  const fanAt = useRef<Walker>(startingWalker(arrangement));
  const markerElement = useRef<HTMLParagraphElement>(null);
  const fog = useMemo(() => horizonColour(), []);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ fov: FOV, near: 0.3, far: 3000 }}
        dpr={[1, 2]}
        aria-label="The line outside the gate. The Fan in light blue with the light on them is you."
        role="img"
      >
        <color attach="background" args={[COLOR.night950]} />
        <fog attach="fog" args={[fog, 50, 150]} />
        <Sky />

        <hemisphereLight args={[COLOR.flood300, COLOR.night950, 0.5]} />
        <directionalLight position={[40, 80, 60]} intensity={0.35} />

        <GateWorld />
        <GateBoard text={board} />
        <QueueLine
          arrangement={arrangement}
          entering={entering}
          reducedMotion={reducedMotion}
          fanAt={fanAt}
        />
        <MarkerFollower fanAt={fanAt} markerRef={markerElement} />

        <GateCamera
          fanAt={fanAt}
          entering={entering}
          reducedMotion={reducedMotion}
          onThrough={onThrough}
        />
      </Canvas>
      <p
        ref={markerElement}
        aria-hidden="true"
        className="glass pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full border border-state-mine/60 px-3 py-1 text-sm text-flood-50 opacity-0"
      >
        {marker}
      </p>
    </div>
  );
}
