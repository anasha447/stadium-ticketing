"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type Fog,
  IcosahedronGeometry,
  RepeatWrapping,
  SphereGeometry,
} from "three";
import { COLOR } from "@/lib/design/tokens";
import { place } from "@/lib/stadium/placing";
import { randomFrom } from "@/lib/stadium/random";
import { type Building, buildCity, buildSkyline } from "@/lib/stadium/surroundings";
import { Instances } from "./instances";
import { box, drawn, join, paint } from "./painted";

// The city around the stadium and the skyline on the horizon. Low blocks
// with a few lit windows fill the middle distance; far out stands a ring of
// taller shapes with Barcelona's landmarks among them, and fog the colour of
// the horizon fades it all into the night sky, so the map has no edge.

/** The colour of the sky where it meets the ground. Fog fades everything distant to this. */
export function horizonColour(): Color {
  return new Color(COLOR.night900).lerp(new Color(COLOR.sceneFacade), 0.4);
}

/**
 * Fog that starts beyond the stadium, wherever the camera is: the stadium is
 * never dimmed, and the city fades more the further away it is. A phone
 * stands much further back than a wide screen, so the distances move with
 * the camera.
 */
export function Haze() {
  const fog = useRef<Fog>(null);
  const colour = useMemo(() => horizonColour(), []);
  useFrame(({ camera }) => {
    if (!fog.current) return;
    const away = camera.position.length();
    fog.current.near = away + 260;
    fog.current.far = away + 2700;
  });
  return <fog ref={fog} attach="fog" args={[colour, 600, 3000]} />;
}

/** Windows of a block at night: most dark, some lit warm, a few cool. The edge stays dark for the roof. */
function windowTexture() {
  const random = randomFrom(1929);
  const texture = drawn(64, 128, (context) => {
    context.fillStyle = COLOR.night950;
    context.fillRect(0, 0, 64, 128);
    for (let column = 0; column < 6; column++) {
      for (let floor = 0; floor < 12; floor++) {
        const chance = random();
        if (chance > 0.3) continue;
        context.fillStyle = chance < 0.22 ? COLOR.sceneLamp : COLOR.flood300;
        context.globalAlpha = 0.35 + 0.65 * random();
        context.fillRect(6 + column * 9, 8 + floor * 10, 5, 5);
      }
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** A unit block standing on the ground. Its roof and floor all read the dark corner of the window texture. */
function blockShape() {
  const block = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const normals = block.getAttribute("normal");
  const uvs = block.getAttribute("uv");
  for (let i = 0; i < uvs.count; i++) {
    if (Math.abs(normals.getY(i)) > 0.5) uvs.setXY(i, 0, 0);
  }
  return block;
}

function standing(buildings: Building[], y: number): Float32Array {
  const matrices = new Float32Array(buildings.length * 16);
  buildings.forEach(({ x, z, wide, deep, tall }, i) => place(matrices, i, x, y, z, 0, 1, wide, tall, deep));
  return matrices;
}

/** How far out the landmarks stand. */
const FAR = 2080;

/**
 * Barcelona on the horizon, as outlines: the Collserola ridge with its tower
 * and the church on Tibidabo, the spires of the Sagrada Família, the Torre
 * Glòries, the two towers by the sea and the hill of Montjuïc. `lit` is the
 * red light on top of each tall thing.
 */
function landmarkShapes() {
  const solid: BufferGeometry[] = [];
  const lit: BufferGeometry[] = [];
  /** Moves parts built around the origin out to the horizon in a direction, facing the stadium. */
  const out = (parts: BufferGeometry[], east: number, south: number, distance = FAR) => {
    const length = Math.hypot(east, south);
    const turn = Math.atan2(east, south);
    return parts.map((part) =>
      part.rotateY(turn).translate((east / length) * distance, 0, (south / length) * distance),
    );
  };
  const hill = (wide: number, tall: number, deep: number, x: number) =>
    paint(new IcosahedronGeometry(1, 1).scale(wide, tall, deep).translate(x, 0, 0), "night900", 1.5);
  const beacon = (x: number, y: number) => box("sceneTaillight", [5, 5, 5], [x, y, 0]);

  // North-west: the ridge behind the city, the tower on it and the church on Tibidabo.
  solid.push(
    ...out(
      [
        hill(620, 150, 220, -320),
        hill(520, 190, 240, 180),
        hill(420, 120, 200, 700),
        paint(new CylinderGeometry(4, 7, 230, 6).translate(220, 290, 0), "night900", 1.6),
        paint(new CylinderGeometry(22, 14, 26, 8).translate(220, 320, 0), "night900", 1.6),
        paint(new ConeGeometry(16, 70, 4).translate(-260, 180, 0), "night900", 1.6),
        box("night900", [50, 34, 30], [-260, 150, 0], undefined, 1.6),
      ],
      -0.62,
      -0.78,
      2250,
    ),
  );
  lit.push(...out([beacon(220, 408)], -0.62, -0.78, 2250));

  // North-east: the Sagrada Família, a cluster of spires round a taller one.
  const spires: BufferGeometry[] = [
    paint(new ConeGeometry(15, 215, 6).translate(0, 107, 0), "night900", 1.8),
    box("night900", [120, 55, 60], [0, 27, 0], undefined, 1.8),
  ];
  for (const [x, z, tall] of [
    [-48, 22, 150],
    [-30, 26, 165],
    [30, 26, 165],
    [48, 22, 150],
    [-40, -24, 140],
    [-22, -28, 155],
    [22, -28, 155],
    [40, -24, 140],
  ]) {
    spires.push(paint(new ConeGeometry(8, tall, 6).translate(x, tall / 2, z), "night900", 1.8));
  }
  solid.push(...out(spires, 0.72, -0.69));
  lit.push(...out([beacon(0, 218)], 0.72, -0.69));

  // East: the Torre Glòries, a tower with a rounded top.
  solid.push(
    ...out(
      [
        paint(new CylinderGeometry(24, 26, 130, 10).translate(0, 65, 0), "sceneFacade", 0.8),
        paint(
          new SphereGeometry(24, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.7, 1).translate(0, 130, 0),
          "sceneFacade",
          0.8,
        ),
      ],
      0.95,
      -0.3,
    ),
  );
  lit.push(...out([beacon(0, 173)], 0.95, -0.3));

  // East-south-east: the two towers by the sea.
  solid.push(
    ...out(
      [
        box("night900", [40, 190, 40], [-55, 95, 0], undefined, 1.8),
        box("night900", [40, 190, 40], [55, 95, 0], undefined, 1.8),
      ],
      0.9,
      0.42,
    ),
  );
  lit.push(...out([beacon(-55, 193), beacon(55, 193)], 0.9, 0.42));

  // South-east: Montjuïc, with the castle on top and the needle of its tower.
  solid.push(
    ...out(
      [
        hill(520, 115, 230, 0),
        box("night900", [90, 22, 60], [-60, 118, 0], undefined, 1.6),
        paint(new CylinderGeometry(2, 5, 150, 5).rotateZ(-0.2).translate(190, 150, 0), "night900", 1.7),
      ],
      0.42,
      0.9,
      2200,
    ),
  );
  lit.push(...out([beacon(205, 226)], 0.42, 0.9, 2200));

  return { solid: join(solid), lit: join(lit) };
}

export function City({ y }: { y: number }) {
  const windows = useMemo(() => windowTexture(), []);
  const tallWindows = useMemo(() => {
    const texture = windowTexture();
    texture.repeat.set(2, 3);
    return texture;
  }, []);
  const shapes = useMemo(() => ({ block: blockShape(), landmarks: landmarkShapes() }), []);
  // The wall's own blue, well dimmed: the city is there, but the stadium is the lit thing.
  const blockColour = useMemo(() => new Color(COLOR.sceneFacade).multiplyScalar(0.55), []);
  const placed = useMemo(
    () => ({ city: standing(buildCity(), y), skyline: standing(buildSkyline(), y) }),
    [y],
  );
  const single = useMemo(() => {
    const matrices = new Float32Array(16);
    place(matrices, 0, 0, y, 0, 0, 1);
    return matrices;
  }, [y]);

  return (
    <group>
      <Instances geometry={shapes.block} matrices={placed.city}>
        <meshLambertMaterial
          color={blockColour}
          emissive={COLOR.flood50}
          emissiveMap={windows}
          emissiveIntensity={0.9}
          flatShading
        />
      </Instances>
      <Instances geometry={shapes.block} matrices={placed.skyline}>
        <meshLambertMaterial
          color={COLOR.night900}
          emissive={COLOR.flood50}
          emissiveMap={tallWindows}
          emissiveIntensity={0.9}
          flatShading
        />
      </Instances>
      <Instances geometry={shapes.landmarks.solid} matrices={single}>
        <meshLambertMaterial vertexColors flatShading />
      </Instances>
      <Instances geometry={shapes.landmarks.lit} matrices={single}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </Instances>
    </group>
  );
}
