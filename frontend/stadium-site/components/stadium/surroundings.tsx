"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { FACADE_HEIGHT, locate, OUTER_DEPTH } from "@/lib/stadium/layout";
import {
  buildLamps,
  FAN_ZONES,
  PLAYERS_ENTRANCE,
  SPOTS,
  STREET_Y,
  WALKWAYS,
  walkwayPoint,
} from "@/lib/stadium/surroundings";
import { Greenery } from "./greenery";
import { Ground } from "./ground";
import { City, Haze } from "./skyline";
import { StreetLife } from "./street-life";
import { FacadeWash, type Pool, StreetLamps } from "./street-lights";
import { Traffic } from "./traffic";

// Everything outside the outer wall. The stadium used to float on a dark
// disc; now it stands on a plaza in a city at night.
//
// It is scenery: nothing here can be clicked, everything repeated is one
// instanced mesh, and the only work done each frame is moving the cars and
// the walking fans along their loops.
//
// The street level (lamps, trees, traffic, fans) is hidden whenever the
// camera is inside the bowl and below the top of the outer wall. The wall is
// 42 m high and nothing on the street is over 16 m, so from there none of it
// could be seen anyway, and that is where the Fan picks a seat: in a Block
// and in a seat the stadium costs what it did before the streets were built.
// The ground and the skyline stay, because they show over the far roof.

/** Whether the street level is being drawn. Shared with the parts that move, so they rest while hidden. */
export interface Shown {
  current: boolean;
}

export function Surroundings({
  playing,
}: {
  /** False holds the traffic and the walking fans still, like the match. */
  playing: boolean;
}) {
  const street = useRef<Group>(null);
  const shown = useRef(true);
  const lamps = useMemo(() => buildLamps(), []);

  /** Warm light on the ground wherever something is lit: gates, counters, screens, the players' entrance. */
  const pools = useMemo((): Pool[] => {
    const gates = WALKWAYS.map((walkway) => ({ ...walkwayPoint(walkway, OUTER_DEPTH + 7), y: 0, size: 34 }));
    const counters = SPOTS.map(({ x, z, fx, fz }) => ({ x: x + fx * 3, y: 0, z: z + fz * 3, size: 22 }));
    const zones = FAN_ZONES.map(({ x, z }) => ({ x, y: 0, z, size: 44 }));
    const { x, z, nx, nz } = PLAYERS_ENTRANCE;
    return [...gates, ...counters, ...zones, { x: x + nx * 6, y: 0, z: z + nz * 6, size: 26 }];
  }, []);

  // Before the parts that move (they run after this), so they see this frame's answer.
  useFrame(({ camera }) => {
    const { x, y, z } = camera.position;
    const behindTheWall = y < FACADE_HEIGHT && locate(x, z).depth < OUTER_DEPTH;
    shown.current = !behindTheWall;
    if (street.current) street.current.visible = shown.current;
  }, -1);

  return (
    <group>
      <Haze />
      <City y={STREET_Y} />
      <Ground />
      <group ref={street}>
        <FacadeWash />
        <StreetLamps lamps={lamps} pools={pools} />
        <Greenery />
        <Traffic playing={playing} shown={shown} />
        <StreetLife playing={playing} shown={shown} />
      </group>
    </group>
  );
}
