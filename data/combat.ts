export const SHIP_SHIELD_HITS = 3;
export const AMETHYST_DURATION = 22.2;
export const ENGAGEMENT_RANGE = 250;
export const MAX_ATTACKERS = 3;
export const ENEMY_DAMAGE = 18;
export const PLAYER_FIRE_INTERVAL = 0.22;
export type Vec = { x: number; y: number; z: number };
export type Patrol = {
  id: number;
  x: number;
  y: number;
  z: number;
  phase: number;
  size: number;
  role: "sentry" | "flyby" | "guardian";
  flightPath?: "oval" | "figure-eight" | "sweep";
};
export function createFleet(seed: number, elevation: number): Patrol[] {
  // Preserve all existing ships and their gentle hovering motion.
  const sentries: Patrol[] = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: (i % 2 ? 1 : -1) * 19,
    y: 15 + i * 1.8 * elevation,
    z: -12 - i * 24,
    phase: seed * 0.1 + i * 1.7,
    size: 12 + (i % 3) * 3,
    role: "sentry",
  }));
  const paths = ["oval", "figure-eight", "sweep"] as const;
  const flyers: Patrol[] = paths.map((flightPath, i) => ({
    id: 22 + i,
    x: 0,
    y: 14 + Math.floor((8 + i * 16) / 3) * 1.6 * elevation,
    z: -72 - i * 160,
    phase: seed * 0.1 + i * 2,
    size: 14,
    role: "flyby",
    flightPath,
  }));
  const guardian: Patrol = {
    id: 25,
    // Start above the first amethyst detour; its anchor follows uncollected gems.
    x: Math.sin(4 * 0.72 + seed) * 10 + 15,
    y: 1.6 * elevation + 12.8,
    z: -33,
    phase: seed * 0.1,
    size: 12,
    role: "guardian",
  };
  return [...sentries, ...flyers, guardian];
}
export function patrolPosition(
  ship: Patrol,
  time: number,
  guardianAnchor?: Vec,
): Vec {
  if (ship.role === "guardian") {
    const center = guardianAnchor ?? ship;
    const phase = time * 0.32 + ship.phase;
    return {
      x: center.x + Math.sin(phase) * 13,
      y: center.y + Math.sin(phase * 0.7) * 1.6,
      z: center.z + Math.cos(phase) * 13,
    };
  }
  if (ship.role === "flyby") {
    const phase = time * 0.13 + ship.phase;
    const x = Math.sin(phase) * (ship.flightPath === "sweep" ? 48 : 34);
    const z =
      ship.flightPath === "figure-eight"
        ? Math.sin(phase * 2) * 55
        : ship.flightPath === "sweep"
          ? Math.sin(phase + 0.65) * 40
          : Math.cos(phase) * 60;
    return {
      x: ship.x + x,
      y: ship.y + Math.sin(phase * 0.8) * 3,
      z: ship.z + z,
    };
  }
  const phase = time * 0.16 + ship.phase;
  return {
    x: ship.x + Math.sin(phase) * 7,
    y: ship.y + Math.sin(phase * 0.7) * 2.5,
    z: ship.z + Math.cos(phase) * 12,
  };
}
export type GuardedGem = Vec & { index: number };
/** Travel smoothly toward the uncollected amethyst nearest the player. */
export function advanceGuardianAnchor(
  current: Vec,
  gems: GuardedGem[],
  collected: ReadonlySet<number>,
  player: Vec,
  delta: number,
): Vec {
  let target: GuardedGem | undefined;
  let nearest = Infinity;
  for (const gem of gems) {
    if (collected.has(gem.index)) continue;
    const distance = Math.hypot(
      gem.x - player.x,
      gem.y - player.y,
      gem.z - player.z,
    );
    if (distance < nearest) {
      nearest = distance;
      target = gem;
    }
  }
  if (!target) return { ...current };
  const dx = target.x - current.x,
    dy = target.y + 9 - current.y,
    dz = target.z - current.z;
  const distance = Math.hypot(dx, dy, dz);
  const step =
    distance > 0 ? Math.min(1, (Math.max(0, delta) * 12) / distance) : 0;
  return {
    x: current.x + dx * step,
    y: current.y + dy * step,
    z: current.z + dz * step,
  };
}
export function attackPriority(ship: Patrol, position: Vec, player: Vec) {
  const distance =
    (position.x - player.x) ** 2 +
    (position.y - player.y) ** 2 +
    (position.z - player.z) ** 2;
  // Reserve attention for the guardian on close approaches to the gem it circles.
  return distance * (ship.role === "guardian" && distance < 45 ** 2 ? 0.25 : 1);
}
export function inEngagementRange(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= ENGAGEMENT_RANGE;
}
/** Earliest collision along a swept segment, including a segment starting inside. */
export function segmentSphere(
  a: Vec,
  b: Vec,
  center: Vec,
  radius: number,
): number | null {
  const x = a.x - center.x,
    y = a.y - center.y,
    z = a.z - center.z;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  const c = x * x + y * y + z * z - radius * radius;
  if (c <= 0) return 0;
  const length = dx * dx + dy * dy + dz * dz;
  if (length < 1e-12) return null;
  const half = x * dx + y * dy + z * dz,
    disc = half * half - length * c;
  if (disc < 0) return null;
  const t = (-half - Math.sqrt(disc)) / length;
  return t >= 0 && t <= 1 ? t : null;
}
