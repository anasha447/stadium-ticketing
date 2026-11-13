import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLOR } from "./tokens";

// Tests run from the app folder, so this path is relative to it.
const css = readFileSync("app/globals.css", "utf8");

/** "sceneTurfLight" -> "scene-turf-light", "night950" -> "night-950", "tier1" -> "tier-1" */
const cssName = (key: string) =>
  key.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();

describe("3D colour tokens", () => {
  it.each(Object.entries(COLOR))("%s matches globals.css", (key, value) => {
    const match = new RegExp(`--color-${cssName(key)}: *(#[0-9a-f]{6})`).exec(css);
    expect(match, `--color-${cssName(key)} is missing from globals.css`).not.toBeNull();
    expect(match![1]).toBe(value);
  });
});
