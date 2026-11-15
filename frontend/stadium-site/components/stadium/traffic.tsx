"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  type BufferGeometry,
  Color,
  InstancedBufferAttribute,
  type InstancedMesh,
  PlaneGeometry,
} from "three";
import { COLOR, type ColorToken } from "@/lib/design/tokens";
import { place } from "@/lib/stadium/placing";
import {
  buildTraffic,
  carAt,
  PLAYERS_ENTRANCE,
  ROAD_Y,
  TEAM_BUSES,
} from "@/lib/stadium/surroundings";
import { Instances } from "./instances";
import { box, glowTexture, join, paint, wheel } from "./painted";
import type { Shown } from "./surroundings";

// The ring road's traffic and the two team buses. Every car is the same
// low model drawn many times; where each one is comes from the time alone
// (lib/stadium/surroundings.ts), so there is nothing to simulate.

/** The paint a car can have. Quiet colours: the cars are scenery. */
const PAINTS: ColorToken[] = ["flood50", "flood300", "flood500", "sceneConcrete", "sceneFacade"];

/** One car, front towards +z, wheels on the ground. The body takes the car's own paint. */
function carShapes() {
  const body = join([
    box("flood50", [1.8, 0.62, 4.3], [0, 0.62, 0]),
    box("night950", [1.56, 0.5, 2.1], [0, 1.18, -0.25]),
    box("flood50", [1.5, 0.06, 1.7], [0, 1.46, -0.25]),
    ...[-1, 1].flatMap((side) =>
      [-1.35, 1.35].map((z) => box("night950", [0.22, 0.62, 0.62], [side * 0.86, 0.31, z])),
    ),
  ]);
  const lamps = join([
    ...[-0.6, 0.6].map((x) => box("flood50", [0.38, 0.16, 0.08], [x, 0.7, 2.16])),
    ...[-0.6, 0.6].map((x) => box("sceneTaillight", [0.42, 0.14, 0.08], [x, 0.75, -2.16])),
  ]);
  // The light they throw on the road: a long pale patch ahead, a short red one behind.
  const onRoad = (wide: number, long: number, z: number) =>
    new PlaneGeometry(wide, long).rotateX(-Math.PI / 2).translate(0, 0.08, z);
  const beams = join([
    paint(onRoad(5.5, 11, 7.4), "flood50", 0.5),
    paint(onRoad(3.6, 3.6, -3.2), "sceneTaillight", 0.45),
  ]);
  return { body, lamps, beams };
}

function Cars({ playing, shown }: { playing: boolean; shown: Shown }) {
  const cars = useMemo(() => buildTraffic(), []);
  const shapes = useMemo(() => carShapes(), []);
  const glow = useMemo(() => glowTexture(), []);
  const paints = useMemo(() => {
    const palette = PAINTS.map((token) => new Color(COLOR[token]));
    const colours = new Float32Array(cars.length * 3);
    cars.forEach((car, i) => palette[car.paint].toArray(colours, i * 3));
    return colours;
  }, [cars]);

  const body = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const beams = useRef<InstancedMesh>(null);
  const seconds = useRef(0);
  const drawn = useRef(-1);

  useLayoutEffect(() => {
    if (!body.current || !lamps.current || !beams.current) return;
    body.current.instanceColor = new InstancedBufferAttribute(paints, 3);
    // All three meshes are the same cars, so they share one set of transforms.
    lamps.current.instanceMatrix = body.current.instanceMatrix;
    beams.current.instanceMatrix = body.current.instanceMatrix;
  }, [paints]);

  useFrame((_, delta) => {
    const mesh = body.current;
    if (!mesh || !shown.current) return;
    // A long gap between frames (a hidden tab) is not a long drive.
    if (playing) seconds.current += Math.min(delta, 0.1);
    if (seconds.current === drawn.current) return;
    drawn.current = seconds.current;
    const matrices = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < cars.length; i++) {
      const { x, z, fx, fz } = carAt(cars[i], seconds.current);
      place(matrices, i, x, ROAD_Y, z, fx, fz);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // The cars are all the way round the stadium, so some are always in view.
  return (
    <group>
      <instancedMesh
        ref={body}
        args={[shapes.body, undefined, cars.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <meshStandardMaterial vertexColors roughness={0.45} metalness={0.3} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={lamps}
        args={[shapes.lamps, undefined, cars.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <meshBasicMaterial vertexColors toneMapped={false} fog={false} />
      </instancedMesh>
      <instancedMesh
        ref={beams}
        args={[shapes.beams, undefined, cars.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <meshBasicMaterial
          map={glow}
          vertexColors
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-8}
        />
      </instancedMesh>
    </group>
  );
}

interface Livery {
  body: ColorToken;
  stripe: ColorToken;
  line: ColorToken;
}

const LIVERY: Record<"home" | "away", Livery> = {
  home: { body: "seatBlau", stripe: "seatGrana", line: "seatOr" },
  away: { body: "flood50", stripe: "sceneKitAway", line: "sceneKitAway" },
};

/**
 * A team coach, front towards +z: 13 m long, three axles, a raked
 * windscreen, a window band with pillars, the door, luggage hatches, mirrors
 * on arms, an air-conditioning unit on the roof and the club's colours along
 * the side. `lit` is everything that shines.
 */
function busShapes({ body, stripe, line }: Livery) {
  const half = 1.275;
  const solid: BufferGeometry[] = [
    // Chassis, body and roof.
    box("night900", [2.45, 0.5, 12.6], [0, 0.6, 0]),
    box(body, [2.55, 2.6, 13], [0, 2.15, 0]),
    box(body, [2.35, 0.14, 12.4], [0, 3.52, 0], undefined, 0.8),
    box("flood300", [1.6, 0.28, 2.6], [0, 3.72, -1.6]),
    box("flood300", [0.9, 0.1, 0.9], [0, 3.63, 3.2]),
    box("flood300", [0.9, 0.1, 0.9], [0, 3.63, -4.6]),
    // Front: windscreen leaning back, bumper, grille.
    box("night950", [2.3, 1.75, 0.1], [0, 2.5, 6.5], [-0.1, 0, 0]),
    box("night900", [2.55, 0.45, 0.3], [0, 0.78, 6.52]),
    box("night950", [1.5, 0.3, 0.06], [0, 1.25, 6.52]),
    // Back: window, engine cover, bumper.
    box("night950", [2.1, 1, 0.08], [0, 2.65, -6.5]),
    box("night900", [1.9, 0.7, 0.06], [0, 1.35, -6.5]),
    box("night900", [2.55, 0.4, 0.25], [0, 0.75, -6.52]),
  ];
  for (const side of [-1, 1]) {
    const x = side * half;
    // The window band: eight panes with a pillar's gap between them.
    for (let pane = 0; pane < 8; pane++) {
      solid.push(box("night950", [0.06, 1.05, 1.22], [x, 2.6, -5.5 + pane * 1.38]));
    }
    // The door on the right, the driver's window on the left.
    solid.push(
      side === 1
        ? box("night950", [0.06, 2.35, 1.05], [x, 1.98, 5.75])
        : box("night950", [0.06, 1.05, 1.05], [x, 2.6, 5.75]),
    );
    // The club's colours: a broad stripe with a fine line under it, and a roundel.
    solid.push(box(stripe, [0.05, 0.44, 12.9], [x, 1.62, 0]));
    solid.push(box(line, [0.05, 0.1, 12.9], [x, 1.3, 0]));
    solid.push(wheel(line, 0.36, 0.07, [x, 1.62, -5.6]));
    // Luggage hatches: a seam along the top and one between each pair.
    solid.push(box("night900", [0.05, 0.04, 6.4], [x, 1.14, 0.4]));
    for (const z of [-2.8, -0.7, 1.4, 3.6]) solid.push(box("night900", [0.05, 0.5, 0.04], [x, 0.9, z]));
    // Three axles: wheels, hubs and the arches over them.
    for (const z of [4.3, -3.3, -4.65]) {
      solid.push(wheel("night950", 0.5, 0.34, [side * 1.1, 0.5, z]));
      solid.push(wheel("flood300", 0.24, 0.36, [side * 1.11, 0.5, z]));
      solid.push(box("night900", [0.08, 0.22, 1.3], [x, 1.08, z]));
    }
    // A mirror on a long arm at each front corner.
    solid.push(box("night900", [0.7, 0.07, 0.07], [side * 1.6, 3.05, 6.5]));
    solid.push(box("night900", [0.12, 0.5, 0.26], [side * 1.95, 2.8, 6.55]));
  }

  const lit: BufferGeometry[] = [
    // Headlights, the sign over the windscreen, tail lights.
    box("flood50", [0.42, 0.2, 0.06], [-0.85, 1.0, 6.69]),
    box("flood50", [0.42, 0.2, 0.06], [0.85, 1.0, 6.69]),
    box("sceneLamp", [1.7, 0.24, 0.06], [0, 3.25, 6.42]),
    box("sceneTaillight", [0.28, 0.5, 0.06], [-1.02, 1.25, -6.66]),
    box("sceneTaillight", [0.28, 0.5, 0.06], [1.02, 1.25, -6.66]),
    // The step light in the open door.
    box("sceneLamp", [0.04, 0.12, 0.9], [half + 0.02, 0.92, 5.75]),
  ];
  // Marker lights along the roof edge.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      lit.push(box("sceneLamp", [0.05, 0.07, 0.16], [side * (half + 0.01), 3.38, -5.6 + k * 2.24]));
    }
  }
  return { solid: join(solid), lit: join(lit) };
}

/** The players' entrance: a canopy out from the wall with a lit ceiling. z points out of the stadium. */
function entranceShapes() {
  const solid = join([
    box("sceneRoof", [12, 0.4, 8], [0, 4.7, 4]),
    box("flood500", [0.3, 4.5, 0.3], [-5.6, 2.25, 7.6]),
    box("flood500", [0.3, 4.5, 0.3], [5.6, 2.25, 7.6]),
    box("night950", [6, 3.6, 0.4], [0, 1.8, 0.3]),
  ]);
  const lit = join([
    box("sceneLamp", [11, 0.08, 7], [0, 4.46, 4]),
    box("flood50", [5, 0.5, 0.1], [0, 4.72, 8.06]),
  ]);
  return { solid, lit };
}

/** The two coaches parked by the players' entrance, and the entrance itself. */
function TeamBuses() {
  const buses = useMemo(
    () =>
      TEAM_BUSES.map((bus) => {
        const matrices = new Float32Array(16);
        place(matrices, 0, bus.x, 0, bus.z, bus.fx, bus.fz);
        return { team: bus.team, matrices, ...busShapes(LIVERY[bus.team]) };
      }),
    [],
  );
  const entrance = useMemo(() => {
    const matrices = new Float32Array(16);
    const { x, z, nx, nz } = PLAYERS_ENTRANCE;
    place(matrices, 0, x, 0, z, nx, nz);
    return { matrices, ...entranceShapes() };
  }, []);

  return (
    <group>
      {[...buses, { team: "entrance", ...entrance }].map(({ team, matrices, solid, lit }) => (
        <group key={team}>
          <Instances geometry={solid} matrices={matrices}>
            <meshStandardMaterial vertexColors roughness={0.4} metalness={0.25} flatShading />
          </Instances>
          <Instances geometry={lit} matrices={matrices}>
            <meshBasicMaterial vertexColors toneMapped={false} />
          </Instances>
        </group>
      ))}
    </group>
  );
}

export function Traffic({ playing, shown }: { playing: boolean; shown: Shown }) {
  return (
    <group>
      <Cars playing={playing} shown={shown} />
      <TeamBuses />
    </group>
  );
}
