"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
  InstancedBufferAttribute,
  type InstancedMesh,
  type Material,
  type MeshLambertMaterial,
  ShaderMaterial,
  type SpotLight,
} from "three";
import { COLOR } from "@/lib/design/tokens";
import { FAN_SHIRTS } from "@/lib/stadium/fans";
import { place } from "@/lib/stadium/placing";
import { type Arrangement, crowdSpot, fanSpot, OTHERS, otherSpot } from "@/lib/waiting-room/line";
import { fadeAt, PACE, step, type Walker } from "@/lib/waiting-room/walk";
import { fanMaterial, fanShape, stride } from "../stadium/fan-figure";

// The Fans in the Waiting Room, as people in a line at the gate. Every other
// Fan is one instanced mesh; this Fan is a figure of their own, in the
// "yours" colour, with a glow round them, a light from above and their
// place over their head. Figures walk to where the line says they should
// be, so the line steps up as Fans ahead go in, and the ones at the front
// walk through the turnstiles into the light and are gone.

/** This Fan's pace when they walk through the gate. */
const ENTER_PACE = 2.1;

/**
 * The fan material, and one more thing: a figure walking into the way in
 * fades into its light. `aFade` is 0 out on the plaza and 1 once they are
 * through.
 */
function fadingFanMaterial() {
  const { material, uniforms } = fanMaterial();
  const dress = material.onBeforeCompile;
  const fadeColour = { value: new Color(COLOR.sceneLamp) };
  material.onBeforeCompile = (shader, renderer) => {
    dress(shader, renderer);
    shader.uniforms.uFadeColour = fadeColour;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = aFade;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uFadeColour;\nvarying float vFade;")
      .replace(
        "#include <opaque_fragment>",
        "outgoingLight = mix(outgoingLight, uFadeColour, vFade);\n#include <opaque_fragment>",
      );
  };
  return { material, uniforms };
}


/** A soft column of light round this Fan, brightest at the edges, as a glow seen from any side. */
function auraMaterial() {
  return new ShaderMaterial({
    uniforms: { uColour: { value: new Color(COLOR.stateMine) } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vHeight;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - world.xyz);
        vHeight = uv.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform vec3 uColour;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vHeight;
      void main() {
        float edge = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
        float fade = smoothstep(0.0, 0.15, vHeight) * (1.0 - smoothstep(0.55, 1.0, vHeight));
        gl_FragColor = vec4(uColour, pow(edge, 2.0) * fade * 0.9);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/** The beam of the light over this Fan, seen in the night air: faint, and fading to nothing at the top. */
function beamMaterial() {
  return new ShaderMaterial({
    uniforms: { uColour: { value: new Color(COLOR.flood50) } },
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColour;
      varying float vHeight;
      void main() {
        gl_FragColor = vec4(uColour, (1.0 - vHeight) * 0.11);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/** Height of the light over this Fan. */
const SPOT_HEIGHT = 11;

export function QueueLine({
  arrangement,
  entering,
  reducedMotion,
  fanAt,
}: {
  arrangement: Arrangement;
  /** True once this Fan has been let in and walks through the gate. */
  entering: boolean;
  reducedMotion: boolean;
  /** Where this Fan is now. Written every frame, for the camera and the marker to follow. */
  fanAt: { current: Walker };
}) {
  const others = useRef<InstancedMesh>(null);
  const mine = useRef<InstancedMesh>(null);
  const around = useRef<Group>(null);
  const spot = useRef<SpotLight>(null);
  const shape = useMemo(() => fanShape(), []);
  const crowdMaterial = useMemo(() => fadingFanMaterial(), []);
  const fanMat = useMemo(() => fadingFanMaterial(), []);
  const aura = useMemo(() => auraMaterial(), []);
  const beam = useMemo(() => beamMaterial(), []);
  const beamShape = useMemo(
    () => new CylinderGeometry(0.5, 1.7, SPOT_HEIGHT, 24, 1, true).translate(0, SPOT_HEIGHT / 2, 0),
    [],
  );
  const auraShape = useMemo(() => new CylinderGeometry(0.62, 0.62, 2.4, 24, 1, true).translate(0, 1.2, 0), []);
  const seconds = useRef(0);

  // Everyone starts where they would stand before the Draw.
  const walkers = useRef<Walker[]>(
    Array.from({ length: OTHERS }, (_, k) => ({ ...crowdSpot(k), walking: false })),
  );
  // Each figure's own stride and shirt, fixed for good.
  const looks = useMemo(() => {
    const palette = FAN_SHIRTS.map((token) => new Color(COLOR[token]));
    const shirts = new Float32Array(OTHERS * 3);
    const strides = new Float32Array(OTHERS * 2);
    for (let k = 0; k < OTHERS; k++) {
      palette[(k * 7 + 3) % palette.length].toArray(shirts, k * 3);
      strides[k * 2] = (k * 2.399) % (Math.PI * 2);
    }
    return { shirts, strides, fades: new Float32Array(OTHERS) };
  }, []);

  useLayoutEffect(() => {
    const crowd = others.current;
    if (crowd) {
      crowd.instanceColor = new InstancedBufferAttribute(looks.shirts, 3);
      crowd.geometry.setAttribute("aStride", new InstancedBufferAttribute(looks.strides, 2));
      crowd.geometry.setAttribute("aFade", new InstancedBufferAttribute(looks.fades, 1));
    }
    const me = mine.current;
    if (me) {
      const tint = new Float32Array(3);
      new Color(COLOR.stateMine).toArray(tint);
      me.instanceColor = new InstancedBufferAttribute(tint, 3);
      me.geometry.setAttribute("aStride", new InstancedBufferAttribute(new Float32Array([0.7, 0]), 2));
      me.geometry.setAttribute("aFade", new InstancedBufferAttribute(new Float32Array(1), 1));
    }
  }, [looks]);

  // The shape is shared, so each mesh gets its own copy for its own attributes.
  const mineShape = useMemo(() => shape.clone(), [shape]);

  useFrame((_, delta) => {
    const crowd = others.current;
    const me = mine.current;
    if (!crowd || !me) return;
    // A slow device or a hidden tab draws few frames; up to half a second a
    // frame keeps the line in step with the real queue without jumping far.
    const dt = Math.min(delta, 0.5);
    seconds.current += dt;
    stride(crowdMaterial.uniforms, seconds.current);
    stride(fanMat.uniforms, seconds.current);

    const matrices = crowd.instanceMatrix.array as Float32Array;
    const strides = crowd.geometry.getAttribute("aStride") as InstancedBufferAttribute | undefined;
    const fades = crowd.geometry.getAttribute("aFade") as InstancedBufferAttribute | undefined;
    if (!strides || !fades) return;
    const walking = strides.array as Float32Array;
    const fading = fades.array as Float32Array;
    for (let k = 0; k < OTHERS; k++) {
      const walker = walkers.current[k];
      step(walker, otherSpot(k, arrangement), dt, PACE, reducedMotion);
      const fade = fadeAt(walker.z);
      // Out of sight down the passage, a figure is shrunk away rather than drawn.
      place(matrices, k, walker.x, 0, walker.z, walker.fx, walker.fz, fade >= 1 ? 0 : 1);
      fading[k] = fade;
      walking[k * 2 + 1] = walker.walking ? 1 : 0;
    }
    crowd.instanceMatrix.needsUpdate = true;
    strides.needsUpdate = true;
    fades.needsUpdate = true;

    // This Fan.
    const you = fanAt.current;
    step(you, fanSpot(arrangement, entering), dt, entering ? ENTER_PACE : PACE, reducedMotion);
    const myMatrices = me.instanceMatrix.array as Float32Array;
    place(myMatrices, 0, you.x, 0, you.z, you.fx, you.fz, 1.04);
    me.instanceMatrix.needsUpdate = true;
    const myStride = me.geometry.getAttribute("aStride") as InstancedBufferAttribute | undefined;
    if (myStride) {
      (myStride.array as Float32Array)[1] = you.walking ? 1 : 0;
      myStride.needsUpdate = true;
    }
    const myFade = me.geometry.getAttribute("aFade") as InstancedBufferAttribute | undefined;
    if (myFade) {
      (myFade.array as Float32Array)[0] = fadeAt(you.z);
      myFade.needsUpdate = true;
    }

    // The glow, the light and the marker go where this Fan goes.
    around.current?.position.set(you.x, 0, you.z);
    const light = spot.current;
    if (light) {
      light.position.set(you.x, SPOT_HEIGHT, you.z + 0.4);
      light.target.position.set(you.x, 0, you.z);
      light.target.updateMatrixWorld();
    }
  });

  return (
    <group>
      <instancedMesh
        ref={others}
        args={[shape, crowdMaterial.material as Material, OTHERS]}
        frustumCulled={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={mine}
        args={[mineShape, fanMat.material as MeshLambertMaterial, 1]}
        frustumCulled={false}
        raycast={() => null}
      />

      <spotLight
        ref={spot}
        color={COLOR.flood50}
        intensity={70}
        distance={18}
        decay={1.2}
        angle={0.2}
        penumbra={0.6}
      />
      <group ref={around}>
        <mesh geometry={auraShape} material={aura} raycast={() => null} />
        <mesh geometry={beamShape} material={beam} raycast={() => null} />
        {/* A ring on the ground, so this Fan is told apart by shape as well as colour. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} raycast={() => null}>
          <ringGeometry args={[0.72, 0.86, 40]} />
          <meshBasicMaterial color={COLOR.stateMine} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** A walker for this Fan, standing where they would before the Draw. */
export function startingWalker(arrangement: Arrangement): Walker {
  return { ...fanSpot(arrangement, false), walking: false };
}
