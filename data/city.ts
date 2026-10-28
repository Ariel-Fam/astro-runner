import type { MapConfig } from "./maps";

export const CITY_BLOCK_LENGTH = 105;
export const CITY_ORIGIN_Z = 40;
export const CITY_GROUND_Y = -40;
export const BUILDING_TYPES = [
  "LimestoneTower",
  "GlassTower",
  "TerraceApartments",
  "BrickWorks",
] as const;

export type BuildingPlacement = {
  x: number;
  z: number;
  h: number;
  w: number;
  d: number;
  rotation: number;
};

/** Leave room for each 18m cross street, its sidewalks, and building depth. */
export function cityBlocks(map: MapConfig) {
  const blocks = Array.from({ length: 6 }, () =>
    BUILDING_TYPES.map(() => [] as BuildingPlacement[]),
  );
  for (let i = 0; i < 156; i++) {
    const random = (n: number) => {
      const v = Math.sin((i + 1) * n + map.seed) * 43758.54;
      return v - Math.floor(v);
    };
    const rawZ = CITY_ORIGIN_Z - random(42) * 630;
    const block = Math.min(
      5,
      Math.floor((CITY_ORIGIN_Z - rawZ) / CITY_BLOCK_LENGTH),
    );
    const start = CITY_ORIGIN_Z - block * CITY_BLOCK_LENGTH;
    const type =
      map.id === "04" && i % 2 === 0
        ? 2
        : map.id === "08" && i % 2 === 0
          ? 3
          : i % 4;
    const w = 5 + random(2) * 12;
    const d = 7 + random(7) * 13;
    const clearance = d / 2 + 14;
    blocks[block][type].push({
      x: (i % 2 ? -1 : 1) * (25 + random(12) * 95),
      z: Math.max(
        start - CITY_BLOCK_LENGTH + clearance,
        Math.min(start - clearance, rawZ),
      ),
      h: 15 + random(8) * 66,
      w,
      d,
      rotation: Math.floor(random(19) * 4) * (Math.PI / 2),
    });
  }
  return blocks;
}
