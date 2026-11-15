import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COLOR, type ColorToken } from "@/lib/design/tokens";

// Small models made of painted blocks. A bus or a food truck is a few dozen
// boxes; each is given one colour on its corners and then they are merged,
// so the whole model is one mesh and one call to the graphics card.

type Vec3 = [number, number, number];

/** Gives a shape one colour all over. `shade` darkens (below 1) or lightens it. */
export function paint(geometry: BufferGeometry, token: ColorToken, shade = 1): BufferGeometry {
  // Merging needs every part in the same form, so all are unrolled to plain triangles.
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const colour = new Color(COLOR[token]).multiplyScalar(shade);
  const count = flat.getAttribute("position").count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colour.toArray(colours, i * 3);
  flat.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return flat;
}

/** A painted box: its size, where its middle is, and an optional turn about x, y and z. */
export function box(token: ColorToken, size: Vec3, at: Vec3, turn?: Vec3, shade = 1): BufferGeometry {
  const geometry = new BoxGeometry(...size);
  if (turn) geometry.rotateX(turn[0]).rotateY(turn[1]).rotateZ(turn[2]);
  return paint(geometry.translate(...at), token, shade);
}

/** A painted wheel or disc lying on its side: the axle runs along x. */
export function wheel(token: ColorToken, radius: number, width: number, at: Vec3, shade = 1): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius, width, 10).rotateZ(Math.PI / 2);
  return paint(geometry.translate(...at), token, shade);
}

/**
 * A painted patch lying flat on the ground: `wide` across and `long` along
 * the unit vector (fx, fz), with its middle at the given place.
 */
export function patch(
  token: ColorToken,
  wide: number,
  long: number,
  at: Vec3,
  fx: number,
  fz: number,
  shade = 1,
): BufferGeometry {
  const geometry = new PlaneGeometry(wide, long).rotateX(-Math.PI / 2).rotateY(Math.atan2(fx, fz));
  return paint(geometry.translate(...at), token, shade);
}

/** Joins painted parts into one shape. */
export function join(parts: BufferGeometry[]): BufferGeometry {
  const joined = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return joined;
}

/** A canvas to draw a texture on, and the texture made from it. */
export function drawn(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft round glow in white, bright in the middle and gone at the edge. The material gives it its colour. */
export function glowTexture(): CanvasTexture {
  return drawn(128, 128, (context) => {
    const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, COLOR.flood50);
    glow.addColorStop(0.25, `${COLOR.flood50}99`);
    glow.addColorStop(1, `${COLOR.flood50}00`);
    context.fillStyle = glow;
    context.fillRect(0, 0, 128, 128);
  });
}
