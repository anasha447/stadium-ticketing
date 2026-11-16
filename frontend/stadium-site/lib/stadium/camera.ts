import type { Block } from "@/lib/domain/types";
import { blockCentre, seatPlace } from "./layout";

// Where the camera stands and what it looks at in each view. Pure numbers;
// the flight between two poses is done by components/stadium/camera-rig.

type Vec3 = [number, number, number];

export interface Pose {
  position: Vec3;
  target: Vec3;
  /** Field of view in degrees. Wider when seated, as an eye sees. */
  fov: number;
}

export const STADIUM_FOV = 38;
export const SEAT_FOV = 55;

/** The middle of the pitch, a little above the grass. */
export const PITCH_CENTRE: Vec3 = [0, 10, 0];

/** The direction the opening view looks from: the south-east, above the roof. */
const VIEW_FROM: Vec3 = [0.5, 0.52, 0.7];
/** Distance at which the whole bowl fits a wide screen. */
const FIT_DISTANCE = 360;

/** Seated eye height above the step. */
export const EYE_HEIGHT = 1.15;

/**
 * How far the look-around point sits in front of a seated camera. Tiny, so
 * dragging turns the head instead of swinging the body around.
 */
export const LOOK_DISTANCE = 0.05;

/** How far back the opening view stands. A tall, narrow screen sees less sideways, so it stands further back. */
export function stadiumFitDistance(aspect: number): number {
  return FIT_DISTANCE * Math.max(1, 1.3 / aspect);
}

/** The opening view. */
export function stadiumPose(aspect: number): Pose {
  const distance = stadiumFitDistance(aspect);
  const length = Math.hypot(...VIEW_FROM);
  return {
    position: VIEW_FROM.map((v) => (v / length) * distance) as Vec3,
    target: PITCH_CENTRE,
    fov: STADIUM_FOV,
  };
}

/** In front of a Block and a little above it, looking at its middle. */
export function blockPose(block: Block): Pose {
  const centre = blockCentre(block);
  const back = 34;
  const up = 13;
  return {
    position: [centre.x - centre.nx * back, centre.y + up, centre.z - centre.nz * back],
    target: [centre.x, centre.y, centre.z],
    fov: STADIUM_FOV,
  };
}

/**
 * Sitting in a seat, looking at the centre spot. The target is the far point
 * the camera looks at; the rig puts the head-turning point just in front of
 * the eyes once the camera has landed.
 */
export function seatPose(block: Block, row: number, seat: number): Pose {
  const place = seatPlace(block, row, seat);
  return {
    position: [place.x, place.y + EYE_HEIGHT, place.z],
    target: [0, 1, 0],
    fov: SEAT_FOV,
  };
}

/** Flights last 1.2 to 1.8 seconds, longer the further they go. */
export function flightSeconds(from: Vec3, to: Vec3): number {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  return Math.min(1.8, Math.max(1.2, distance / 90));
}

/** Slow start, slow stop: the easing for anything that travels. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
