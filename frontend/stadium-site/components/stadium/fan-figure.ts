import { Color, MeshLambertMaterial } from "three";
import { COLOR } from "@/lib/design/tokens";
import { box, join } from "./painted";

// One low-poly fan standing on the ground, and the material that dresses and
// walks them. Shared by the fans outside the stadium and the Waiting Room line.

/** Above this height on the figure is the head; below HIP are the legs. */
const HEAD_FROM = 1.5;
const HIP = 0.86;

/** One fan standing, facing +z, feet on the ground: two legs, a body and a head. */
export function fanShape() {
  return join([
    box("flood50", [0.17, HIP, 0.2], [-0.12, HIP / 2, 0]),
    box("flood50", [0.17, HIP, 0.2], [0.12, HIP / 2, 0]),
    box("flood50", [0.46, 0.64, 0.25], [0, HIP + 0.32, 0]),
    box("flood50", [0.21, 0.25, 0.22], [0, 1.64, 0]),
  ]);
}

export interface StrideUniforms {
  uTime: { value: number };
  uSkinLight: { value: Color };
  uSkinDark: { value: Color };
  uHair: { value: Color };
  uLegs: { value: Color };
}

/**
 * A plain matt material with two additions, as for the fans in the seats.
 * The shirt colour covers the body only: legs are dark, and the head is skin
 * with hair. And a walking fan's legs swing, each the opposite way to the
 * other, so a crowd on a walkway looks like it is walking and not sliding.
 * `aStride` is a fan's place in their stride and whether they walk at all.
 */
export function fanMaterial() {
  const uniforms: StrideUniforms = {
    uTime: { value: 0 },
    uSkinLight: { value: new Color(COLOR.sceneSkinLight) },
    uSkinDark: { value: new Color(COLOR.sceneSkinDark) },
    uHair: { value: new Color(COLOR.night900) },
    uLegs: { value: new Color(COLOR.sceneFacade) },
  };
  const material = new MeshLambertMaterial();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform vec3 uSkinLight;\nuniform vec3 uSkinDark;\nuniform vec3 uHair;\nattribute vec2 aStride;\nvarying vec3 vFanAt;\nvarying vec3 vFanSkin;\nvarying vec3 vFanHair;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vFanAt = position;
        // A tone per fan that never changes, taken from their place in the stride.
        float tone = fract(aStride.x * 1.731);
        vFanSkin = mix(uSkinLight, uSkinDark, tone * tone);
        vFanHair = mix(uHair, uSkinDark, 0.7 * fract(tone * 7.31));
        float swing = sin(uTime * 6.5 + aStride.x) * aStride.y;
        if (position.y < ${HIP.toFixed(2)}) {
          transformed.z += sign(position.x) * swing * (${HIP.toFixed(2)} - position.y) * 0.55;
        }
        transformed.y += abs(swing) * 0.04;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uLegs;\nvarying vec3 vFanAt;\nvarying vec3 vFanSkin;\nvarying vec3 vFanHair;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (vFanAt.y > ${HEAD_FROM.toFixed(2)}) {
          bool hair = vFanAt.y > 1.71 || vFanAt.z < 0.0;
          diffuseColor.rgb = hair ? vFanHair : vFanSkin;
        } else if (vFanAt.y < ${HIP.toFixed(2)}) {
          diffuseColor.rgb = uLegs;
        }`,
      );
  };
  return { material, uniforms };
}

/** Moves every walking fan's stride on to a time, in seconds. */
export function stride(uniforms: StrideUniforms, seconds: number) {
  uniforms.uTime.value = seconds;
}
