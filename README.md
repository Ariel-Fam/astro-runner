# Astro Runner

A browser parkour game set above New Eden, built with Next.js 16, React Three Fiber, Three.js, and GSAP. Eight selectable districts feature elevated alternate lanes, side plazas, checkpoints, collectible signals, and a finish gate. Best times are saved locally.

## Run

```sh
npm install
npm run dev
```

Open the local address printed by Next.js. Desktop keyboard and mouse are recommended. The home page and onboarding support smaller screens; gameplay requires a keyboard.

## Controls

| Input             | Action                                                         |
| ----------------- | -------------------------------------------------------------- |
| WASD / arrow keys | Camera-relative movement                                       |
| Shift             | Sprint                                                         |
| Space             | Jump; press again for double jump                              |
| B                 | Backflip                                                       |
| Mouse click       | Capture pointer                                                |
| Mouse drag        | Look without pointer capture                                   |
| Scroll            | Camera distance                                                |
| E                 | Equip weapon / enter shoulder aim                              |
| Left mouse / F    | Hold to fire while aiming (first mouse click captures pointer) |
| R                 | Lower weapon; respawn when unarmed                             |
| Esc               | Pause / resume                                                 |

## Districts

Skyline District, The Undercity, Solar Array, Cloud Gardens, Neon Exchange, Zero Point, The Spire, and The Driftworks. Solar Array features launch pads; Neon Exchange features moving decks and laser hurdles; Zero Point has lower gravity; Driftworks adds broad freight platforms, cargo obstacles, and elevated gantries.

## Hostile patrols

Every district keeps its twenty-two original hovering ships and adds three ships flying oval, figure-eight, and sweeping routes, plus one amethyst guardian (26 ships total). The guardian smoothly travels toward the uncollected gemstone nearest the player, circles above it, and takes priority when the player approaches. Its purple ring identifies it. All ships use the same force-field, damage, and destruction rules. The original ships use all four supplied ship GLBs, normalized to 12–18 meters along their longest axis.

Patrols track the route, with at most three attackers selected by distance. Ships only fire within 250 meters, with a visible charge-up and staggered volleys. Cover blocks projectiles in both directions. Enemy balls travel at 29 m/s and deal 18 damage; the player weapon fires at 155 m/s every 0.22 seconds. Three hits break a ship’s visible force field; a fourth destroys it for the rest of the run. Enemy volleys recur every 1.98–2.57 seconds (two successive global 15% increases and a further 9% increase in firing rate).

E stops horizontal movement and disables jumping while keeping mouse aiming and firing available. R lowers the weapon and restores movement. E equips the supplied `shootingPose.glb`, turns the character with the camera, and moves to a shoulder view. Left mouse fires after pointer capture; F also fires without pointer capture. R lowers the weapon, and R while unarmed respawns at the current checkpoint. Health depletion or falling below the rooftops opens Game over; Restart begins a fresh run. New checkpoints refill health; respawns grant temporary protection and clear incoming projectiles. Pausing freezes combat. Ship assets load progressively and enemies wait until all models load before attacking.

Nine decorative White Orb landmarks float above each district, spread along the full route. Their diameters vary from 54 to 70 meters, larger than the ships, and the supplied logo texture faces the viewing camera. They do not block movement or lasers.

## Signals, shields, and audio

Routes now span 52 main platforms with thirteen checkpoints beyond the starting deck. Each octahedron awards 100 points, once per run. Thirteen small square bounce pads, spaced every four main platforms, launch you through an amethyst cluster; each crystal grants 22.2 seconds of immunity to ship fire, shown by a purple suit aura and countdown. Missing the detour can be fatal. All checkpoints have text/arrow beacons; only the final checkpoint in each district has a large ARK 11 ship.

The Sound Mix panel independently mutes and adjusts music and effects, saving preferences on this device. Pulsar loops during play; footsteps follow grounded movement and sprint cadence, ship hover fades with distance, and each weapon uses its supplied sound. Pausing, game over, and returning home stop playback. Browser audio begins with a player gesture.

A controls and survival guide appears on the home page immediately before the ARK 11 Odyssey artwork link. Four onboarding steps cover movement, jumping, stationary aiming and firing, shields, checkpoints, points, audio, and restart.

## Implementation

- `components/game/RunnerApp.tsx`: menus, GSAP onboarding, HUD, saved times, and settings.
- `components/game/World.tsx`: procedural architecture, character animation blending, camera, and movement.
- `components/game/Combat.tsx`: shooting pose, ship patrols, projectiles, damage, and destruction.
- `data/combat.ts`: engagement rules, patrol paths, and swept projectile collision.
- `data/maps.ts`: district definitions, routes, and obstacle geometry.
- `data/physics.ts`: swept deck landing, underside collision, and lateral sliding.
- `data/animationMap.ts`: aligned animation clips in `public/models/6animations.glb`. Jump and backflip clips blend into `Fall2` after completion; walking off a ledge also uses `Fall2`. The character uses the existing opaque material preparation.

The kinematic controller includes acceleration/deceleration, air steering, jump buffering, coyote time, double jumps, moving-platform carry, checkpoint respawn, and camera obstruction handling. Pause freezes movement and platform simulation. Controls and camera conventions are grounded in [next-js-3d-dojo](https://github.com/Ariel-Fam/next-js-3d-dojo).

Static ships and crystals use derived files in `public/models/gameplay/` (about 60,000 triangles each). Originals remain untouched. Run `npm run optimize-models` to regenerate them with meshoptimizer.

## Verify

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Automated checks cover landing, underside and side collisions, route gaps, checkpoints, moving-platform bounds, the eighth district, the 250m engagement boundary, fleet density, and projectile sweeps. They complement manual browser playtesting rather than replacing a complete traversal of every route.
