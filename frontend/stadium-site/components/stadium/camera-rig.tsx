"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, useEffect, useRef } from "react";
import { MathUtils, type PerspectiveCamera, Vector3 } from "three";
import type { Block } from "@/lib/domain/types";
import {
  blockPose,
  easeInOut,
  flightSeconds,
  LOOK_DISTANCE,
  type Pose,
  seatPose,
  stadiumFitDistance,
  stadiumPose,
} from "@/lib/stadium/camera";
import {
  type Clearance,
  flightLift,
  flightPoint,
  holdClear,
  type Rows,
  STADIUM_COME_IN,
  STADIUM_LOWEST_TILT,
  STADIUM_MIN_DISTANCE,
  stadiumMaxDistance,
} from "@/lib/stadium/camera-bounds";
import type { View } from "@/lib/stadium/view";

// Moves the camera between the three views. A flight carries the camera's
// place, the point it looks at and its field of view along one eased curve.
// Between flights the Fan drives: spinning the stadium, circling a Block,
// or turning their head in a seat.
//
// The camera stays on the stadium. It cannot be panned, it zooms only as far
// as the stadium still fills the view, and the stadium is solid to it: every
// frame its place is checked against lib/stadium/camera-bounds, and a camera
// that would be under the ground or inside a wall, the roof or a terrace is
// held at the last clear point on its line of sight.

type Controls = ComponentRef<typeof OrbitControls>;

interface Flight {
  fromPosition: Vector3;
  fromLook: Vector3;
  fromFov: number;
  to: Pose;
  /** How high the flight arcs in the middle, to go over the roof and not through it. */
  lift: number;
  seconds: number;
  elapsed: number;
  landing: View["kind"];
}

/** How far ahead the camera is taken to be looking when a flight starts from a seat. */
const LOOK_AHEAD = 60;

/** How far a seated Fan can zoom in, and out, as a field of view in degrees. */
const MIN_SEAT_FOV = 20;
const MAX_SEAT_FOV = 70;

const facing = new Vector3();

/** Notes which way the camera faces along the ground. */
function writeHeading(heading: { current: Heading }, camera: PerspectiveCamera) {
  camera.getWorldDirection(facing);
  heading.current = { x: facing.x, z: facing.z };
}

/**
 * How close the camera may come to a surface. Over the whole stadium it
 * keeps well clear; in a Block it comes close enough to pick a seat, and
 * stays inside the bowl.
 */
const CLEARANCE: Record<"stadium" | "block", Clearance> = {
  stadium: { margin: 4, comeIn: STADIUM_COME_IN },
  block: { margin: 1.5, inside: true },
};

/** What the Fan may do with the camera once it has landed. `aspect` is the screen's width over its height. */
function handOver(controls: Controls, kind: View["kind"], aspect: number) {
  controls.enabled = true;
  if (kind === "stadium") {
    // From inside the bowl out to where the stadium still fills the view.
    // Any further and the Fan would be looking at the streets.
    controls.minDistance = STADIUM_MIN_DISTANCE;
    controls.maxDistance = stadiumMaxDistance(stadiumFitDistance(aspect));
    controls.minPolarAngle = 0;
    // Stay above the ground, and never look up from below it.
    controls.maxPolarAngle = Math.PI / 2 - STADIUM_LOWEST_TILT;
    controls.rotateSpeed = 1;
    controls.enableZoom = true;
  } else if (kind === "block") {
    controls.minDistance = 10;
    controls.maxDistance = 110;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = 1.75;
    controls.rotateSpeed = 0.6;
    controls.enableZoom = true;
  } else {
    // Seated: the camera stays put and dragging turns the head. The speed is
    // negative so the view follows the drag, as when you turn to look.
    controls.minDistance = LOOK_DISTANCE;
    controls.maxDistance = LOOK_DISTANCE;
    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = 2.5;
    controls.rotateSpeed = -0.35;
    controls.enableZoom = false;
  }
}

/** Nothing may clamp the camera while it is in the air. */
function letGo(controls: Controls) {
  controls.enabled = false;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
}

/** Which way the camera faces on the ground, for the mini-map. Updated every frame. */
export interface Heading {
  x: number;
  z: number;
}

export function CameraRig({
  view,
  blocks,
  rows,
  reducedMotion,
  heading,
}: {
  view: View;
  blocks: Block[];
  /** Rows per Level: the shape of the terraces the camera must stay out of. */
  rows: Rows;
  reducedMotion: boolean;
  heading: { current: Heading };
}) {
  const controls = useRef<Controls>(null);
  const get = useThree((state) => state.get);
  const flight = useRef<Flight | null>(null);
  const look = useRef(new Vector3());
  const touched = useRef(false);
  /** The last place the camera was in clear air. It goes back there if it has nowhere else to go. */
  const clearAt = useRef(new Vector3());
  /** Where the Fan had the camera when they left the stadium view. */
  const leftStadiumAt = useRef<Pose | null>(null);
  const lastKind = useRef<View["kind"] | null>(null);
  /** Finishes the flight in progress; set by the effect that started it. */
  const landRef = useRef<((pose: Pose) => void) | null>(null);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const { camera: anyCamera, size } = get();
    const camera = anyCamera as PerspectiveCamera;

    const block = view.kind === "stadium" ? null : blocks.find((b) => b.id === view.blockId);
    const to: Pose =
      view.kind === "seat" && block
        ? seatPose(block, view.row, view.seat)
        : view.kind === "block" && block
          ? blockPose(block)
          : (leftStadiumAt.current ?? stadiumPose(size.width / size.height));

    const land = (pose: Pose) => {
      camera.position.set(...pose.position);
      camera.fov = pose.fov;
      camera.near = view.kind === "seat" ? 0.1 : 1;
      camera.updateProjectionMatrix();
      look.current.set(...pose.target);
      if (view.kind === "seat") {
        // Put the turning point just in front of the eyes.
        const ahead = look.current.clone().sub(camera.position).setLength(LOOK_DISTANCE);
        orbit.target.copy(camera.position).add(ahead);
      } else {
        orbit.target.copy(look.current);
      }
      camera.lookAt(look.current);
      handOver(orbit, view.kind, size.width / size.height);
      orbit.update();
      clearAt.current.copy(camera.position);
      flight.current = null;
    };

    const first = lastKind.current === null;
    if (lastKind.current === "stadium" && view.kind !== "stadium") {
      leftStadiumAt.current = {
        position: camera.position.toArray(),
        target: orbit.target.toArray(),
        fov: camera.fov,
      };
    }
    const fromSeat = lastKind.current === "seat";
    lastKind.current = view.kind;

    if (first || reducedMotion) {
      // No flight on first load, and none for Fans who asked for less motion.
      land(to);
      return;
    }

    // Start from wherever the camera is now, even in the middle of a flight.
    const fromLook = flight.current
      ? look.current.clone()
      : fromSeat
        ? camera.getWorldDirection(new Vector3()).multiplyScalar(LOOK_AHEAD).add(camera.position)
        : orbit.target.clone();
    letGo(orbit);
    camera.near = fromSeat || view.kind === "seat" ? 0.1 : 1;
    camera.updateProjectionMatrix();
    flight.current = {
      fromPosition: camera.position.clone(),
      fromLook,
      fromFov: camera.fov,
      to,
      lift: flightLift(rows, camera.position.toArray(), to.position),
      seconds: flightSeconds(camera.position.toArray(), to.position),
      elapsed: 0,
      landing: view.kind,
    };
    // `land` is reused when the flight ends.
    landRef.current = land;
  }, [view, blocks, rows, reducedMotion, get]);

  // A window that changes shape changes how far back the stadium view may pull.
  const aspect = useThree((state) => state.size.width / state.size.height);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || flight.current || lastKind.current !== "stadium") return;
    orbit.maxDistance = stadiumMaxDistance(stadiumFitDistance(aspect));
  }, [aspect]);

  useFrame((state, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    const camera = state.camera as PerspectiveCamera;
    const current = flight.current;

    orbit.autoRotate =
      !current && lastKind.current === "stadium" && !touched.current && !reducedMotion;
    writeHeading(heading, camera);

    if (!current) {
      // Seated, the camera does not move, so there is nothing to hold back.
      const kind = lastKind.current;
      if (kind !== "stadium" && kind !== "block") return;
      const at = camera.position;
      if (at.equals(clearAt.current)) return;
      // A turn that swings the camera into something moves it in or out
      // along its line of sight; a zoom stops at the first thing in the way.
      const held = holdClear(
        rows,
        orbit.target.toArray(),
        [at.x, at.y, at.z],
        clearAt.current.toArray(),
        CLEARANCE[kind],
        orbit.minDistance,
        orbit.maxDistance,
      );
      const before = at.clone();
      if (held) at.set(...held);
      else at.copy(clearAt.current);
      if (at.distanceToSquared(before) > 1e-8) camera.lookAt(orbit.target);
      clearAt.current.copy(at);
      return;
    }
    current.elapsed += delta;
    const t = Math.min(1, current.elapsed / current.seconds);
    if (t >= 1) {
      landRef.current?.(current.to);
      return;
    }
    const k = easeInOut(t);
    const [lx, ly, lz] = current.to.target;
    camera.position.set(
      ...flightPoint(current.fromPosition.toArray(), current.to.position, current.lift, k),
    );
    look.current.set(
      MathUtils.lerp(current.fromLook.x, lx, k),
      MathUtils.lerp(current.fromLook.y, ly, k),
      MathUtils.lerp(current.fromLook.z, lz, k),
    );
    camera.fov = MathUtils.lerp(current.fromFov, current.to.fov, k);
    camera.updateProjectionMatrix();
    camera.lookAt(look.current);
  });

  // Seated, the wheel and a pinch zoom by narrowing the view, not by moving
  // the camera.
  useEffect(() => {
    if (view.kind !== "seat") return;
    const { gl, events, camera: anyCamera } = get();
    const camera = anyCamera as PerspectiveCamera;
    // The element the orbit controls listen on. They capture the pointer
    // there, so the fingers' moves are only seen on that element.
    const element = (events.connected as HTMLElement | undefined) ?? gl.domElement;
    const zoom = (by: number) => {
      if (flight.current) return;
      camera.fov = MathUtils.clamp(camera.fov * by, MIN_SEAT_FOV, MAX_SEAT_FOV);
      camera.updateProjectionMatrix();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(Math.exp(event.deltaY * 0.0006));
    };

    // Two fingers apart narrow the view; together widen it.
    const fingers = new Map<number, { x: number; y: number }>();
    let spread = 0;
    const apart = () => {
      const [a, b] = [...fingers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size === 2) spread = apart();
    };
    const onMove = (event: PointerEvent) => {
      if (!fingers.has(event.pointerId)) return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size !== 2 || spread === 0) return;
      const now = apart();
      zoom(spread / now);
      spread = now;
    };
    const onUp = (event: PointerEvent) => {
      fingers.delete(event.pointerId);
      spread = 0;
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
    };
  }, [view.kind, get]);

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      autoRotateSpeed={0.35}
      onStart={() => {
        touched.current = true;
      }}
    />
  );
}
