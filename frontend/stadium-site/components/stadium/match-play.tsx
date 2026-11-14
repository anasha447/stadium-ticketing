"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  type InstancedMesh,
  type Mesh,
  Object3D,
  SphereGeometry,
} from "three";
import { COLOR, type ColorToken } from "@/lib/design/tokens";
import { type Kit, matchAt, STILL_MOMENT } from "@/lib/stadium/match-play";

// The match being played: 22 players, a referee and a ball. Where they are
// comes from lib/stadium/match-play; this file only draws them.
//
// A figure is three parts (legs, shirt, head), each an instanced mesh of 23,
// so the whole match is four draw calls.

const FIGURES = 23;

/** Players are drawn a little larger than life so they read from the top Rows. */
const FIGURE_SCALE = 1.3;
/** The ball is drawn at nearly three times its real size, for the same reason. */
const BALL_RADIUS = 0.3;

const SHIRT: Record<Kit, ColorToken> = {
  home: "seatBlau",
  away: "flood50",
  keeper: "sceneKitKeeper",
  referee: "seatOr",
};
const SHORTS: Record<Kit, ColorToken> = {
  home: "seatGrana",
  away: "sceneKitAway",
  keeper: "sceneKitKeeper",
  referee: "night950",
};

interface Parts {
  legs: InstancedMesh;
  shirts: InstancedMesh;
  heads: InstancedMesh;
  ball: Mesh;
}

const scratch = new Object3D();

/** Puts every figure and the ball where the match has them at `seconds`. */
function place({ legs, shirts, heads, ball }: Parts, seconds: number, running: boolean) {
  const moment = matchAt(seconds);
  moment.figures.forEach((figure, i) => {
    // A small bounce while play is on, each figure out of step with the next.
    const bounce = running ? 0.07 * Math.abs(Math.sin(seconds * 7 + i * 1.3)) : 0;
    scratch.position.set(figure.x, bounce, figure.z);
    scratch.rotation.set(0, figure.turn, 0);
    scratch.scale.setScalar(FIGURE_SCALE);
    scratch.updateMatrix();
    for (const part of [legs, shirts, heads]) part.setMatrixAt(i, scratch.matrix);
  });
  for (const part of [legs, shirts, heads]) part.instanceMatrix.needsUpdate = true;
  ball.position.set(moment.ball.x, moment.ball.y, moment.ball.z);
}

/** Gives each figure its kit. The colours never change after this. */
function dress({ legs, shirts, heads }: Parts) {
  const skin = [new Color(COLOR.sceneSkinLight), new Color(COLOR.sceneSkinDark)];
  const colour = new Color();
  matchAt(0).figures.forEach((figure, i) => {
    shirts.setColorAt(i, colour.set(COLOR[SHIRT[figure.kit]]));
    legs.setColorAt(i, colour.set(COLOR[SHORTS[figure.kit]]));
    heads.setColorAt(i, colour.copy(skin[0]).lerp(skin[1], ((i * 7) % 10) / 10));
  });
  for (const part of [legs, shirts, heads]) part.instanceColor!.needsUpdate = true;
}

export function MatchPlay({ playing }: { playing: boolean }) {
  const legs = useRef<InstancedMesh>(null);
  const shirts = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const ball = useRef<Mesh>(null);
  const seconds = useRef(STILL_MOMENT);

  const shapes = useMemo(
    () => ({
      legs: new BoxGeometry(0.36, 0.85, 0.22).translate(0, 0.425, 0),
      shirt: new BoxGeometry(0.46, 0.62, 0.26).translate(0, 1.16, 0),
      head: new SphereGeometry(0.13, 8, 6).translate(0, 1.62, 0),
    }),
    [],
  );

  const parts = (): Parts | null =>
    legs.current && shirts.current && heads.current && ball.current
      ? { legs: legs.current, shirts: shirts.current, heads: heads.current, ball: ball.current }
      : null;

  useLayoutEffect(() => {
    const all = parts();
    if (!all) return;
    dress(all);
    place(all, seconds.current, false);
  }, []);

  useFrame((_, delta) => {
    if (!playing) return;
    const all = parts();
    if (!all) return;
    // A tab left in the background comes back with one long frame; do not
    // let the match leap forward with it.
    seconds.current += Math.min(delta, 0.1);
    place(all, seconds.current, true);
  });

  return (
    <group>
      <instancedMesh ref={legs} args={[shapes.legs, undefined, FIGURES]} raycast={() => null}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={shirts} args={[shapes.shirt, undefined, FIGURES]} raycast={() => null}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[shapes.head, undefined, FIGURES]} raycast={() => null}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <mesh ref={ball} raycast={() => null}>
        <sphereGeometry args={[BALL_RADIUS, 12, 10]} />
        <meshStandardMaterial color={COLOR.flood50} roughness={0.5} />
      </mesh>
    </group>
  );
}
