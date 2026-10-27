export type MapConfig = {
  id: string;
  name: string;
  district: string;
  description: string;
  difficulty: string;
  color: string;
  sky: string;
  concrete: string;
  height: number;
  seed: number;
  feature: string;
};
export const maps: MapConfig[] = [
  {
    id: "01",
    name: "Skyline District",
    district: "NEW EDEN / SECTOR 01",
    description:
      "Find your flow above the city. Rooftops, skybridges, and a horizon that never ends.",
    difficulty: "OPEN RUN",
    color: "#d4f86a",
    sky: "#b9bca5",
    concrete: "#a5aa96",
    height: 1,
    seed: 3,
    feature: "ROOFTOPS & SKYBRIDGES",
  },
  {
    id: "02",
    name: "The Undercity",
    district: "NEW EDEN / SECTOR 02",
    description:
      "Follow the violet light through the forgotten infrastructure beneath New Eden.",
    difficulty: "INTERMEDIATE",
    color: "#b9a1fa",
    sky: "#444958",
    concrete: "#666c7c",
    height: 0.7,
    seed: 9,
    feature: "PIPELINES & SERVICE DECKS",
  },
  {
    id: "03",
    name: "Solar Array",
    district: "HELIOS / SECTOR 03",
    description:
      "Chase the last light across a vast field of suspended energy collectors.",
    difficulty: "INTERMEDIATE",
    color: "#ffbe79",
    sky: "#c7a789",
    concrete: "#a79b87",
    height: 1.2,
    seed: 17,
    feature: "COLLECTORS & JUMP PADS",
  },
  {
    id: "04",
    name: "Cloud Gardens",
    district: "ARCADIA / SECTOR 04",
    description:
      "An elevated sanctuary. Take the scenic route through overgrown terraces.",
    difficulty: "OPEN RUN",
    color: "#9fe5bc",
    sky: "#a7c2b5",
    concrete: "#8dafa0",
    height: 1.1,
    seed: 23,
    feature: "GARDENS & TERRACES",
  },
  {
    id: "05",
    name: "Neon Exchange",
    district: "NEXUS / SECTOR 05",
    description:
      "Thread the signal. Narrow crossings and moving transit decks above the exchange.",
    difficulty: "ADVANCED",
    color: "#ff8fba",
    sky: "#56536c",
    concrete: "#74748c",
    height: 1.4,
    seed: 31,
    feature: "MOVING DECKS & LASERS",
  },
  {
    id: "06",
    name: "Zero Point",
    district: "ORBITAL / SECTOR 06",
    description:
      "Leave the skyline behind. Test your momentum on the edge of the atmosphere.",
    difficulty: "ADVANCED",
    color: "#9adcf1",
    sky: "#728d9f",
    concrete: "#9babb5",
    height: 1.7,
    seed: 43,
    feature: "LOW GRAVITY & HIGH ROUTES",
  },
  {
    id: "07",
    name: "The Spire",
    district: "ZENITH / SECTOR 07",
    description:
      "The only way is up. A final ascent through the highest structures in New Eden.",
    difficulty: "EXPERT",
    color: "#efdf99",
    sky: "#bcb29a",
    concrete: "#a7a28e",
    height: 2,
    seed: 51,
    feature: "VERTICAL ASCENT",
  },
  {
    id: "08",
    name: "The Driftworks",
    district: "FREIGHT / SECTOR 08",
    description:
      "A shipyard in the sky. Cross broad freight decks, climb the gantries, and catch a moving cargo platform.",
    difficulty: "INTERMEDIATE",
    color: "#f6aa68",
    sky: "#acb7b6",
    concrete: "#8b9994",
    height: 1.3,
    seed: 67,
    feature: "FREIGHT DECKS & GANTRIES",
  },
];
export type Platform = {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: "deck" | "beam" | "moving" | "pad";
  checkpoint?: boolean;
  amethyst?: boolean;
};
export function createPlatforms(map: MapConfig): Platform[] {
  const result: Platform[] = [
    { x: 0, y: 0, z: 8, w: 16, d: 19, h: 4, kind: "deck", checkpoint: true },
  ];
  for (let i = 1; i <= 52; i++) {
    const z = 8 - i * 10;
    const x = Math.sin(i * 0.72 + map.seed) * 10;
    const y = Math.floor(i / 3) * 1.6 * map.height;
    result.push({
      x,
      y,
      z,
      w: map.id === "08" ? 14 : i % 3 === 0 ? 13 : 8,
      d: 8,
      h: 2.5 + (i % 3),
      kind:
        (map.id === "05" && i % 4 === 0) || (map.id === "08" && i % 5 === 0)
          ? "moving"
          : map.id === "03" && i % 5 === 0
            ? "pad"
            : "deck",
      checkpoint: i % 4 === 0,
    });
    if (i % 4 === 0) {
      // Optional plazas widen the route and reward exploration away from the gate.
      result.push({
        x: x - 10,
        y: y + 0.7,
        z,
        w: 7,
        d: 3,
        h: 0.8,
        kind: "beam",
      });
      result.push({
        x: x - 20,
        y: y + 1.4,
        z,
        w: 14,
        d: 12,
        h: 2,
        kind: "deck",
      });
    }
    if (i % 4 === 0) {
      // Optional sprint/double-jump detour over open air. The pad launches
      // the player through the crystal and back toward the main route.
      result.push({
        x: x + 15,
        y: y + 0.8,
        z: z - 1,
        w: 3.2,
        d: 3.2,
        h: 1,
        kind: "pad",
        amethyst: true,
      });
    }
    // A continuous, broad lower route plus a tighter optional upper lane.
    if (i % 3 !== 0)
      result.push({
        x: x + (map.id === "08" ? 16 : 12),
        y: y + (map.id === "08" ? 3.6 : 2.8),
        z: z + 2,
        w: 5,
        d: 7,
        h: 1.2,
        kind: "beam",
      });
    if (i % 3 === 0)
      result.push({
        x: x + 6,
        y: y + 1.4,
        z: z + 4,
        w: 5,
        d: 5,
        h: 1,
        kind: "deck",
      });
  }
  return result;
}
export function platformX(p: Platform, time: number) {
  return p.x + (p.kind === "moving" ? Math.sin(time * 0.7 + p.z) * 3 : 0);
}

/** Obstacles share their geometry with collision handling, including themed props. */
export function createObstacles(
  map: MapConfig,
  platforms: Platform[],
): Platform[] {
  return platforms
    .filter((p) => p.kind === "deck" && !p.checkpoint)
    .map((p, i) => {
      const hurdle = i % 3 === 0;
      const h =
        map.id === "07" && !hurdle
          ? 2.8
          : map.id === "08" && !hurdle
            ? 1.8
            : hurdle
              ? 0.8
              : 1.15;
      return {
        x: p.x + (hurdle ? 0 : (i % 2 ? 1 : -1) * (p.w / 2 - 1.4)),
        y: p.y + h,
        z: p.z,
        w: hurdle ? p.w * 0.65 : map.id === "08" ? 2.8 : 1.8,
        d: hurdle ? 0.55 : map.id === "08" ? 4 : 2.5,
        h,
        kind: "beam",
      };
    });
}

export type SkyOrb = {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
};
/** Large floating landmarks flank the full route without entering the jump lanes. */
export function createSkyOrbs(map: MapConfig): SkyOrb[] {
  const route = createPlatforms(map).filter((p) => p.d === 8);
  return Array.from({ length: 9 }, (_, i) => {
    const platform = route[Math.round((i * (route.length - 1)) / 8)];
    return {
      x: (i % 2 ? -1 : 1) * (98 + Math.sin(map.seed + i * 1.7) * 10),
      y: Math.max(86, platform.y + 70),
      z: platform.z - 12,
      size: [54, 62, 70][i % 3],
      phase: map.seed * 0.1 + i * 1.4,
    };
  });
}
