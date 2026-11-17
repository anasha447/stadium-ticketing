"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  PlaneGeometry,
} from "three";
import { COLOR } from "@/lib/design/tokens";
import { FAN_SHIRTS } from "@/lib/stadium/fans";
import { place } from "@/lib/stadium/placing";
import {
  buildStanders,
  buildWalkers,
  FAN_ZONE,
  FAN_ZONES,
  SPOTS,
  walkerAt,
  WALKWAYS,
  walkwayPoint,
} from "@/lib/stadium/surroundings";
import { fanMaterial, fanShape, stride } from "./fan-figure";
import { Instances } from "./instances";
import { box, drawn, join, paint } from "./painted";
import type { Shown } from "./surroundings";

// Life outside the stadium: fans walking in along the walkways, groups
// standing at the food trucks and stalls, and a crowd at each fan zone
// screen. Every fan out here is one mesh; the walkers are moved a little
// each frame and the rest never move.

/** Everyone outside: the walkers first, then the fans who stand still. */
function Fans({ playing, shown }: { playing: boolean; shown: Shown }) {
  const mesh = useRef<InstancedMesh>(null);
  const shape = useMemo(() => fanShape(), []);
  const { material, uniforms } = useMemo(() => fanMaterial(), []);
  const seconds = useRef(0);
  const drawn = useRef(-1);

  const crowd = useMemo(() => {
    const walkers = buildWalkers();
    const standers = buildStanders();
    const count = walkers.length + standers.length;
    const palette = FAN_SHIRTS.map((token) => new Color(COLOR[token]));
    const shirts = new Float32Array(count * 3);
    const strides = new Float32Array(count * 2);
    const matrices = new Float32Array(count * 16);

    // Where each walker's walkway starts and which way it runs, worked out once.
    const paths = walkers.map(({ walkway, across }) => {
      const { nx, nz } = WALKWAYS[walkway];
      const origin = walkwayPoint(WALKWAYS[walkway], 0, across);
      return { x: origin.x, z: origin.z, nx, nz };
    });
    walkers.forEach((walker, i) => {
      palette[walker.shirt].toArray(shirts, i * 3);
      strides.set([walker.stride, 1], i * 2);
    });
    standers.forEach((fan, k) => {
      const i = walkers.length + k;
      palette[fan.shirt].toArray(shirts, i * 3);
      // Not walking, but the number still gives them their own skin and hair.
      strides.set([fan.x * 0.37 + fan.z * 0.11, 0], i * 2);
      place(matrices, i, fan.x, fan.y, fan.z, fan.fx, fan.fz, fan.size);
    });
    return { walkers, paths, count, shirts, strides, matrices };
  }, []);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    (instanced.instanceMatrix.array as Float32Array).set(crowd.matrices);
    instanced.instanceColor = new InstancedBufferAttribute(crowd.shirts, 3);
    instanced.geometry.setAttribute("aStride", new InstancedBufferAttribute(crowd.strides, 2));
  }, [crowd]);

  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced || !shown.current) return;
    if (playing) seconds.current += Math.min(delta, 0.1);
    if (seconds.current === drawn.current) return;
    drawn.current = seconds.current;
    stride(uniforms, seconds.current);

    const matrices = instanced.instanceMatrix.array as Float32Array;
    const { walkers, paths } = crowd;
    for (let i = 0; i < walkers.length; i++) {
      const { depth, y, size } = walkerAt(walkers[i], seconds.current);
      const { x, z, nx, nz } = paths[i];
      // They face the stadium: back along the walkway.
      place(matrices, i, x + nx * depth, y, z + nz * depth, -nx, -nz, size);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });

  // Fans are on every side of the stadium, so some are always in view.
  return (
    <instancedMesh
      ref={mesh}
      args={[shape, material, crowd.count]}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}

/** A food truck, counter towards +z: a van with a lit serving hatch, an awning and a sign on the roof. */
function truckShapes() {
  const solid: BufferGeometry[] = [
    box("flood50", [5.6, 2.3, 2.3], [0, 1.75, 0]),
    box("seatGrana", [5.62, 0.5, 2.32], [0, 0.95, 0]),
    box("flood300", [1.5, 1.7, 2.2], [3.5, 1.45, 0]),
    box("night950", [0.06, 0.8, 1.9], [4.27, 1.85, 0]),
    box("flood300", [3.5, 0.08, 0.55], [-0.4, 1.45, 1.4]),
    box("flood300", [1, 0.3, 1], [-1.6, 3.05, -0.3]),
    ...[-1.9, 1.9].flatMap((x) => [-1.1, 1.1].map((z) => box("night950", [0.7, 0.7, 0.26], [x, 0.35, z]))),
  ];
  // The awning over the hatch, in the club's stripes.
  for (let i = 0; i < 6; i++) {
    solid.push(
      box(i % 2 === 0 ? "seatBlau" : "seatGrana", [0.62, 0.08, 1.5], [-1.95 + i * 0.62, 2.72, 1.85], [0.28, 0, 0]),
    );
  }
  const lit: BufferGeometry[] = [
    box("sceneLamp", [3.2, 1, 0.06], [-0.4, 2.05, 1.17]),
    box("seatOr", [2.2, 0.5, 0.12], [-0.4, 3.2, 0.9]),
  ];
  // A string of bulbs along the edge of the awning.
  for (let i = 0; i < 7; i++) lit.push(box("sceneLamp", [0.12, 0.12, 0.12], [-2.1 + i * 0.57, 2.48, 2.55]));
  return { solid: join(solid), lit: join(lit) };
}

/** A merchandise stall, counter towards +z: a tent on four posts, a table of scarves, shirts hung at the back. */
function stallShapes() {
  const goods = ["seatBlau", "seatGrana", "seatOr"] as const;
  const solid: BufferGeometry[] = [
    ...[-2, 2].flatMap((x) => [-1.5, 1.5].map((z) => box("flood300", [0.12, 2.6, 0.12], [x, 1.3, z]))),
    paint(
      new ConeGeometry(3.1, 1.3, 4).rotateY(Math.PI / 4).scale(1, 1, 0.8).translate(0, 3.35, 0),
      "seatBlau",
    ),
    box("seatGrana", [4.4, 0.32, 3.4], [0, 2.56, 0]),
    box("flood300", [3.8, 0.9, 0.9], [0, 0.45, 1.1]),
    box("night900", [4, 2, 0.08], [0, 1.5, -1.45]),
  ];
  for (let i = 0; i < 6; i++) {
    solid.push(box(goods[i % 3], [0.5, 0.15, 0.6], [-1.5 + i * 0.6, 0.98, 1.1]));
  }
  for (let i = 0; i < 5; i++) {
    solid.push(box(goods[(i + 1) % 3], [0.56, 0.7, 0.05], [-1.5 + i * 0.75, 1.75, -1.38]));
  }
  const lit: BufferGeometry[] = [box("sceneLamp", [1.4, 0.1, 0.7], [0, 2.36, 0.2])];
  for (let i = 0; i < 8; i++) lit.push(box("sceneLamp", [0.12, 0.12, 0.12], [-2.1 + i * 0.6, 2.34, 1.72]));
  return { solid: join(solid), lit: join(lit) };
}

/** The frame of a fan zone's big screen, on two legs, with a row of flags either side. z points at the crowd. */
function screenFrameShape() {
  const flags = ["seatBlau", "seatGrana", "seatOr"] as const;
  const parts: BufferGeometry[] = [
    box("night900", [15.2, 8.4, 0.6], [0, 5.8, 0]),
    box("night900", [0.6, 1.6, 0.6], [-5.5, 0.8, 0]),
    box("night900", [0.6, 1.6, 0.6], [5.5, 0.8, 0]),
  ];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = side * (9 + i * 1.6);
      parts.push(box("flood300", [0.1, 8, 0.1], [x, 4, 0.4 + i * 2]));
      parts.push(box(flags[i], [1.5, 0.95, 0.04], [x + side * 0.8, 7.4, 0.4 + i * 2]));
    }
  }
  return join(parts);
}

/** What the fan zone screens show: the match, as a pitch seen from the side with a score bar over it. */
function screenTexture() {
  return drawn(256, 128, (context) => {
    for (let stripe = 0; stripe < 8; stripe++) {
      context.fillStyle = stripe % 2 === 0 ? COLOR.sceneTurfLight : COLOR.sceneTurfDark;
      context.fillRect(stripe * 32, 0, 32, 128);
    }
    context.strokeStyle = COLOR.flood50;
    context.lineWidth = 2;
    context.strokeRect(10, 26, 236, 94);
    context.beginPath();
    context.moveTo(128, 26);
    context.lineTo(128, 120);
    context.moveTo(146, 73);
    context.arc(128, 73, 18, 0, Math.PI * 2);
    context.stroke();
    context.strokeRect(10, 50, 34, 46);
    context.strokeRect(212, 50, 34, 46);
    // The score bar: a chip in each side's colour.
    context.fillStyle = COLOR.night900;
    context.fillRect(0, 0, 256, 18);
    context.fillStyle = COLOR.seatBlau;
    context.fillRect(86, 4, 30, 10);
    context.fillStyle = COLOR.seatGrana;
    context.fillRect(100, 4, 16, 10);
    context.fillStyle = COLOR.sceneKitAway;
    context.fillRect(140, 4, 30, 10);
    context.fillStyle = COLOR.flood50;
    context.fillRect(124, 7, 8, 3);
  });
}

/** Food trucks, merchandise stalls and the two fan zone screens. */
function Stands() {
  const shapes = useMemo(
    () => ({
      truck: truckShapes(),
      stall: stallShapes(),
      frame: screenFrameShape(),
      screen: new PlaneGeometry(14.2, 7.4).translate(0, 5.8, 0.32),
    }),
    [],
  );
  const picture = useMemo(() => screenTexture(), []);

  const placed = useMemo(() => {
    const of = (kind: "truck" | "stall") => {
      const spots = SPOTS.filter((s) => s.kind === kind);
      const matrices = new Float32Array(spots.length * 16);
      spots.forEach(({ x, z, fx, fz }, i) => place(matrices, i, x, 0, z, fx, fz));
      return matrices;
    };
    const screens = new Float32Array(FAN_ZONES.length * 16);
    FAN_ZONES.forEach(({ x, z, nx, nz }, i) => {
      // On the stadium side of the zone, facing the crowd.
      const back = FAN_ZONE.deep / 2 - 0.5;
      place(screens, i, x - nx * back, 0, z - nz * back, nx, nz);
    });
    return { trucks: of("truck"), stalls: of("stall"), screens };
  }, []);

  return (
    <group>
      {(
        [
          [shapes.truck, placed.trucks],
          [shapes.stall, placed.stalls],
        ] as const
      ).map(([shape, matrices], i) => (
        <group key={i}>
          <Instances geometry={shape.solid} matrices={matrices}>
            <meshLambertMaterial vertexColors flatShading />
          </Instances>
          <Instances geometry={shape.lit} matrices={matrices}>
            <meshBasicMaterial vertexColors toneMapped={false} />
          </Instances>
        </group>
      ))}
      <Instances geometry={shapes.frame} matrices={placed.screens}>
        <meshLambertMaterial vertexColors flatShading />
      </Instances>
      <Instances geometry={shapes.screen} matrices={placed.screens}>
        <meshBasicMaterial map={picture} toneMapped={false} />
      </Instances>
    </group>
  );
}

export function StreetLife({ playing, shown }: { playing: boolean; shown: Shown }) {
  return (
    <group>
      <Fans playing={playing} shown={shown} />
      <Stands />
    </group>
  );
}
