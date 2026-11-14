"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  InstancedBufferAttribute,
  type InstancedMesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COLOR } from "@/lib/design/tokens";
import type { Block } from "@/lib/domain/types";
import { blocksNear, buildFans, FAN_SHIRTS, type FanInstances } from "@/lib/stadium/fans";
import type { SeatInstances } from "@/lib/stadium/seats";

// A seated fan on every sold seat. Like the seats they are instanced: a
// small figure sent to the graphics card once and repeated thousands of
// times.
//
// Half the stadium is sold, so that is about 30,000 fans. Drawing each one
// in full costs nearly half as much again as the whole stadium without
// them, so only the Blocks around the open one get the full figure (body,
// legs, head). Everyone further away is a single block with a head-coloured
// top, which is all that can be seen from there.
//
// The stadium view keeps the mosaic clear, so fans are only there once the
// Fan has gone into a Block. They rise into their seats as the camera flies
// in and sink away when it flies back out.

/** How long the fans take to appear or leave, in seconds. */
const RISE_SECONDS = 0.5;

/**
 * In seat view the fans this close to the Fan's own seat are left out: the
 * row in front and the seats either side. Their heads would fill the bottom
 * of the picture, and the point of the view is the pitch.
 */
const CLEAR_METRES = 1.3;

/** Everything above this height on the figure is the head. */
const HEAD_FROM = 0.99;

/** The top of a fan's head. */
const TOP = 1.2;
/** Hair covers the head above this height, and everything behind FACE_FROM (the fan faces +z). */
const HAIR_FROM = 1.15;
const FACE_FROM = 0.0;

/** One fan, sitting. Same origin as a seat: front faces +z, the step is at y = 0. */
function fanShape() {
  const torso = new BoxGeometry(0.4, 0.5, 0.2).translate(0, 0.72, -0.05);
  const thighs = new BoxGeometry(0.36, 0.13, 0.38).translate(0, 0.52, 0.16);
  const head = new BoxGeometry(0.19, TOP - HEAD_FROM, 0.2).translate(0, (TOP + HEAD_FROM) / 2, -0.04);
  return mergeGeometries([torso, thighs, head]);
}

/** The same fan from far away: one block, a third of the triangles. */
function farFanShape() {
  return new BoxGeometry(0.32, TOP - 0.47, 0.2).translate(0, (TOP + 0.47) / 2, -0.05);
}

interface FanUniforms {
  uGrow: { value: number };
  /** Where the Fan is sitting, and how far around them is kept clear (0 for nowhere). */
  uClearAt: { value: Vector3 };
  uClearRadius: { value: number };
  uSkinLight: { value: Color };
  uSkinDark: { value: Color };
  uHair: { value: Color };
}

/**
 * The standard material with two small additions: everything above the
 * shoulders is a head (a face at the front, hair on top and behind) and not
 * the shirt colour, and the whole figure can be shrunk to nothing about its
 * own seat.
 */
function fanMaterial() {
  const uniforms: FanUniforms = {
    uGrow: { value: 0 },
    uClearAt: { value: new Vector3() },
    uClearRadius: { value: 0 },
    uSkinLight: { value: new Color(COLOR.sceneSkinLight) },
    uSkinDark: { value: new Color(COLOR.sceneSkinDark) },
    uHair: { value: new Color(COLOR.night900) },
  };
  const material = new MeshStandardMaterial({ roughness: 0.9 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uGrow;\nuniform vec3 uClearAt;\nuniform float uClearRadius;\nuniform vec3 uSkinLight;\nuniform vec3 uSkinDark;\nuniform vec3 uHair;\nvarying vec3 vFanAt;\nvarying vec3 vFanSkin;\nvarying vec3 vFanHair;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vFanAt = position;
        vFanSkin = uSkinLight;
        vFanHair = uHair;
        float fanSize = uGrow;
        #ifdef USE_INSTANCING
          // A tone per fan, taken from where they sit so it never changes.
          float tone = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
          vFanSkin = mix(uSkinLight, uSkinDark, tone * tone);
          // Hair runs from black to brown, and not in step with the skin.
          vFanHair = mix(uHair, uSkinDark, 0.7 * fract(tone * 7.31));
          if (distance(instanceMatrix[3].xyz, uClearAt) < uClearRadius) fanSize = 0.0;
        #endif
        transformed *= fanSize;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vFanAt;\nvarying vec3 vFanSkin;\nvarying vec3 vFanHair;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (vFanAt.y > ${HEAD_FROM.toFixed(2)}) {
          bool hair = vFanAt.y > ${HAIR_FROM.toFixed(2)} || vFanAt.z < ${FACE_FROM.toFixed(2)};
          diffuseColor.rgb = hair ? vFanHair : vFanSkin;
        }`,
      );
  };
  return { material, uniforms };
}

/** Moves the fans towards shown or hidden and returns how far along they are, 0 to 1. */
function rise(
  meshes: InstancedMesh[],
  uniforms: FanUniforms,
  progress: number,
  shown: boolean,
  delta: number,
  instant: boolean,
): number {
  const step = instant ? 1 : delta / RISE_SECONDS;
  const next = Math.max(0, Math.min(1, progress + (shown ? step : -step)));
  // Arrive gently: fast at first, slowing into the seat.
  uniforms.uGrow.value = 1 - (1 - next) ** 3;
  for (const mesh of meshes) mesh.visible = next > 0;
  return next;
}

/** Keeps the seats around the Fan clear of other fans, or lets everyone back with `null`. */
function clearAround(uniforms: FanUniforms, at: [number, number, number] | null) {
  if (at) uniforms.uClearAt.value.set(...at);
  uniforms.uClearRadius.value = at ? CLEAR_METRES : 0;
}

/** Sits the fans down: a place and a shirt for each, and how many there are. */
function seat(mesh: InstancedMesh, fans: FanInstances) {
  const colours = mesh.instanceColor;
  if (!colours) return;

  mesh.instanceMatrix.array.set(fans.matrices);
  mesh.instanceMatrix.needsUpdate = true;

  const palette = FAN_SHIRTS.map((name) => new Color(COLOR[name]));
  const values = colours.array as Float32Array;
  for (let i = 0; i < fans.count; i++) palette[fans.shirts[i]].toArray(values, i * 3);
  colours.needsUpdate = true;

  mesh.count = fans.count;
}

/** Makes room for a fan on every seat. Done once; Seat States only change how many are in use. */
function makeRoom(mesh: InstancedMesh, seatCount: number) {
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(seatCount * 3), 3);
  mesh.count = 0;
  mesh.visible = false;
}

export function Fans({
  blocks,
  seats,
  states,
  openBlockId,
  sittingAt,
  reducedMotion,
}: {
  blocks: Block[];
  seats: SeatInstances;
  /** Seat States by Block id. A sold seat ("S") gets a fan. */
  states: Record<string, string>;
  /** The Block the Fan is in. With none (the stadium view) there are no fans. */
  openBlockId: string | null;
  /** Where the Fan is sitting, in seat view. */
  sittingAt: [number, number, number] | null;
  reducedMotion: boolean;
}) {
  const nearMesh = useRef<InstancedMesh>(null);
  const farMesh = useRef<InstancedMesh>(null);
  const shapes = useMemo(() => ({ near: fanShape(), far: farFanShape() }), []);
  const { material, uniforms } = useMemo(() => fanMaterial(), []);
  const progress = useRef(0);
  const shown = openBlockId !== null;

  const fans = useMemo(() => {
    const near = openBlockId ? blocksNear(blocks, seats, openBlockId) : new Set<string>();
    return {
      near: buildFans(blocks, seats, states, (id) => near.has(id)),
      far: buildFans(blocks, seats, states, (id) => !near.has(id)),
    };
  }, [blocks, seats, states, openBlockId]);

  useLayoutEffect(() => {
    if (nearMesh.current) makeRoom(nearMesh.current, seats.count);
    if (farMesh.current) makeRoom(farMesh.current, seats.count);
  }, [seats]);

  useLayoutEffect(() => {
    if (nearMesh.current) seat(nearMesh.current, fans.near);
    if (farMesh.current) seat(farMesh.current, fans.far);
  }, [fans, seats]);

  useLayoutEffect(() => {
    clearAround(uniforms, sittingAt);
  }, [uniforms, sittingAt]);

  useFrame((_, delta) => {
    if (!nearMesh.current || !farMesh.current) return;
    const done = shown ? 1 : 0;
    if (progress.current === done) return;
    progress.current = rise(
      [nearMesh.current, farMesh.current],
      uniforms,
      progress.current,
      shown,
      delta,
      reducedMotion,
    );
  });

  // The fans fill the whole bowl, so there is nothing to gain from testing
  // whether they are in view, and they are never clicked.
  return (
    <group>
      <instancedMesh
        ref={nearMesh}
        args={[shapes.near, material, seats.count]}
        frustumCulled={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={farMesh}
        args={[shapes.far, material, seats.count]}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  );
}
