import type { Platform } from "./maps";
export type Point = { x: number; y: number; z: number };
export const BODY_RADIUS = 0.3;
export const BODY_HEIGHT = 1.7;
/** Swept vertical collision prevents fast falls from tunnelling through decks. */
export function resolvePlatform(
  position: Point,
  previous: Point,
  velocity: Point,
  p: Platform,
  x: number,
): boolean {
  const inside =
    Math.abs(position.x - x) < p.w / 2 + BODY_RADIUS &&
    Math.abs(position.z - p.z) < p.d / 2 + BODY_RADIUS;
  if (!inside) return false;
  if (previous.y >= p.y - 0.15 && position.y <= p.y && velocity.y <= 0) {
    position.y = p.y;
    velocity.y = 0;
    return true;
  }
  const bottom = p.y - p.h;
  if (
    velocity.y > 0 &&
    previous.y + BODY_HEIGHT <= bottom + 0.12 &&
    position.y + BODY_HEIGHT >= bottom
  ) {
    position.y = bottom - BODY_HEIGHT;
    velocity.y = 0;
    return false;
  }
  if (position.y < p.y - 0.12 && position.y + BODY_HEIGHT > bottom) {
    const left = Math.abs(position.x - x) - p.w / 2,
      front = Math.abs(position.z - p.z) - p.d / 2;
    if (left > front) {
      position.x = x + Math.sign(position.x - x || 1) * (p.w / 2 + BODY_RADIUS);
      velocity.x = 0;
    } else {
      position.z =
        p.z + Math.sign(position.z - p.z || 1) * (p.d / 2 + BODY_RADIUS);
      velocity.z = 0;
    }
  }
  return false;
}
