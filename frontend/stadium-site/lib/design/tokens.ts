// The design tokens that 3D code needs, as plain values. Three.js cannot read
// CSS, so these mirror app/globals.css; tokens.test.ts fails if they differ.
// Anything drawn in the canvas takes its colour from here.

export const COLOR = {
  night950: "#05070f",
  night900: "#0b1020",
  flood50: "#f4f1ea",
  flood300: "#a7aec2",
  flood500: "#7b83a0",

  seatBlau: "#1f4fa8",
  seatGrana: "#9e1b4b",
  seatOr: "#f2c230",

  tierPremium: "#b79cff",
  tier1: "#5aa9ff",
  tier2: "#35c2b0",
  tier3: "#8fa3bf",
  stateHeld: "#ffb020",
  stateSold: "#3a4158",
  stateMine: "#7cf5ff",

  sceneConcrete: "#6f7890",
  sceneFacade: "#364063",
  sceneRoof: "#dfe6f5",
  sceneTurfLight: "#2f8f46",
  sceneTurfDark: "#277c3c",
  sceneTurfEdge: "#1d5c30",
  sceneKitAway: "#3d9be0",
  sceneKitKeeper: "#b8e34a",
  sceneSkinLight: "#e3b592",
  sceneSkinDark: "#7a4f35",

  scenePaving: "#454c63",
  scenePavingLight: "#5f6780",
  sceneAsphalt: "#171b29",
  sceneFoliage: "#24573a",
  sceneFoliageLight: "#3b7a45",
  sceneBark: "#4a3a2e",
  sceneLamp: "#ffc98a",
  sceneTaillight: "#ff3a2f",
} as const;

export type ColorToken = keyof typeof COLOR;
