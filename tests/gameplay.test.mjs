import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
// Transpile the actual pure game modules; no browser or alternate test implementation.
async function moduleFrom(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
  );
}
const { maps, createPlatforms, createObstacles, createSkyOrbs, platformX } =
  await moduleFrom("../data/maps.ts");
const { resolvePlatform } = await moduleFrom("../data/physics.ts");
const deck = { x: 0, y: 0, z: 0, w: 8, d: 8, h: 2, kind: "deck" };
test("fast downward motion lands on a deck rather than tunnelling through it", () => {
  const p = { x: 0, y: -3, z: 0 },
    v = { x: 1, y: -40, z: 0 };
  assert.equal(resolvePlatform(p, { x: 0, y: 2, z: 0 }, v, deck, 0), true);
  assert.equal(p.y, 0);
  assert.equal(v.y, 0);
});
test("jumping into a deck underside stops upward velocity", () => {
  const p = { x: 0, y: -3, z: 0 },
    v = { x: 0, y: 10, z: 0 };
  assert.equal(resolvePlatform(p, { x: 0, y: -4, z: 0 }, v, deck, 0), false);
  assert.equal(p.y, -3.7);
  assert.equal(v.y, 0);
});
test("side collisions stop penetration while preserving tangential motion", () => {
  const p = { x: 3.9, y: -1, z: 0 },
    v = { x: -5, y: 0, z: 3 };
  resolvePlatform(p, { x: 4.4, y: -1, z: 0 }, v, deck, 0);
  assert.equal(p.x, 4.3);
  assert.equal(v.x, 0);
  assert.equal(v.z, 3);
});
test("a jump outside the deck footprint is not caught by the deck", () => {
  const p = { x: 6, y: -1, z: 0 },
    v = { x: 0, y: -8, z: 0 };
  assert.equal(resolvePlatform(p, { x: 6, y: 1, z: 0 }, v, deck, 0), false);
  assert.equal(p.y, -1);
});
test("all eight districts have reachable main routes and thirteen saved checkpoints", () => {
  assert.equal(maps.length, 8);
  assert.equal(new Set(maps.map((m) => m.id)).size, 8);
  for (const map of maps) {
    const platforms = createPlatforms(map),
      main = platforms.filter((p) => p.kind !== "beam" && p.d === 8);
    assert.equal(main.length, 52, map.name);
    assert.equal(platforms.filter((p) => p.checkpoint).length, 14, map.name);
    assert.ok(
      platforms.some((p) => p.kind === "beam" && p.y > 2),
      map.name,
    );
    let prev = platforms[0];
    for (const p of main) {
      const dx = Math.max(0, Math.abs(p.x - prev.x) - (p.w + prev.w) / 2),
        dz = Math.max(0, Math.abs(p.z - prev.z) - (p.d + prev.d) / 2);
      assert.ok(
        Math.hypot(dx, dz) < 10,
        `${map.name}: gap beyond sprint double jump`,
      );
      assert.ok(p.y - prev.y < 4, `${map.name}: ascent beyond double jump`);
      prev = p;
    }
    for (const p of createObstacles(map, platforms))
      assert.ok(p.h > 0 && p.w > 0 && p.d > 0);
  }
});
test("moving deck collision positions match their animation and stay in range", () => {
  const p = createPlatforms(maps[4]).find((p) => p.kind === "moving");
  assert.ok(p);
  for (let t = 0; t < 30; t += 0.1)
    assert.ok(Math.abs(platformX(p, t) - p.x) <= 3);
  assert.equal(platformX({ ...p, kind: "deck" }, 10), p.x);
});

test("moving checkpoint respawn centers stay inside the deck at every phase", () => {
  const checkpoints = createPlatforms(maps[4]).filter(
    (p) => p.kind === "moving" && p.checkpoint,
  );
  assert.ok(checkpoints.length > 0);
  for (const p of checkpoints)
    for (let t = 0; t < 20; t += 0.13) {
      assert.ok(Math.abs(p.x - platformX(p, t)) < p.w / 2);
    }
});
test("Driftworks includes broad freight decks, moving carriers, and elevated gantries", () => {
  const map = maps.find((m) => m.id === "08"),
    platforms = createPlatforms(map);
  assert.ok(platforms.filter((p) => p.w === 14 && p.d === 8).length >= 18);
  assert.ok(platforms.filter((p) => p.kind === "moving").length >= 3);
  assert.ok(platforms.some((p) => p.kind === "beam" && p.y >= 3.6));
  assert.ok(
    createObstacles(map, platforms).some((p) => p.h === 1.8 && p.d === 4),
  );
});

const {
  createFleet,
  patrolPosition,
  advanceGuardianAnchor,
  attackPriority,
  inEngagementRange,
  segmentSphere,
  MAX_ATTACKERS,
  ENEMY_DAMAGE,
} = await moduleFrom("../data/combat.ts");
test("ships may engage at 250m but never outside the requested range", () => {
  const player = { x: 0, y: 0, z: 0 };
  assert.equal(inEngagementRange(player, { x: 250, y: 0, z: 0 }), true);
  assert.equal(inEngagementRange(player, { x: 250.01, y: 0, z: 0 }), false);
  assert.equal(inEngagementRange(player, { x: 0, y: 251, z: 0 }), false);
});
test("each district has twenty-two staggered, oversized patrols across the route", () => {
  for (const map of maps) {
    const allShips = createFleet(map.seed, map.height);
    const fleet = allShips.filter((ship) => ship.role === "sentry");
    assert.equal(allShips.length, 26);
    assert.equal(new Set(allShips.map((ship) => ship.id)).size, 26);
    assert.equal(fleet.length, 22);
    assert.ok(MAX_ATTACKERS < fleet.length);
    assert.equal(new Set(fleet.map((s) => s.z)).size, 22);
    for (const s of fleet) {
      assert.equal(s.x, (s.id % 2 ? 1 : -1) * 19);
      assert.equal(s.y, 15 + s.id * 1.8 * map.height);
      assert.equal(s.z, -12 - s.id * 24);
      assert.equal(s.phase, map.seed * 0.1 + s.id * 1.7);
      assert.equal(s.size, 12 + (s.id % 3) * 3);
      const p = patrolPosition(s, 25);
      assert.ok(Math.abs(p.x - s.x) <= 7);
      assert.ok(Math.abs(p.y - s.y) <= 2.5);
      assert.ok(Math.abs(p.z - s.z) <= 12);
    }
  }
});
test("swept projectiles hit targets crossed between frames", () => {
  assert.equal(
    segmentSphere(
      { x: -10, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      1,
    ),
    0.45,
  );
  assert.equal(
    segmentSphere(
      { x: -10, y: 2, z: 0 },
      { x: 10, y: 2, z: 0 },
      { x: 0, y: 0, z: 0 },
      1,
    ),
    null,
  );
  assert.equal(
    segmentSphere(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      1,
    ),
    0,
  );
  assert.equal(
    segmentSphere(
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      1,
    ),
    null,
  );
  assert.ok(
    Math.ceil(100 / ENEMY_DAMAGE) >= 5,
    "one enemy shot cannot kill the player",
  );
});

function readGlb(path) {
  const buffer = readFileSync(new URL(path, import.meta.url));
  const jsonLength = buffer.readUInt32LE(12);
  return {
    doc: JSON.parse(buffer.subarray(20, 20 + jsonLength)),
    bin: buffer.subarray(28 + jsonLength),
  };
}
test("every mapped character action exists in the new asset with aligned locomotion clips", async () => {
  const { animationMap6Model: actions } = await moduleFrom(
    "../data/animationMap.ts",
  );
  const { doc } = readGlb("../public/models/6animations.glb");
  const clips = new Map(
    doc.animations.map((a) => [
      a.name,
      Math.max(...a.samplers.map((s) => doc.accessors[s.input].max[0])),
    ]),
  );
  assert.equal(new Set(Object.values(actions)).size, 6);
  for (const action of Object.values(actions))
    assert.ok(clips.has(action), action);
  assert.equal(actions.falling, "Fall2");
  assert.ok(clips.get(actions.idle) > 5);
  assert.ok(clips.get(actions.running) < clips.get(actions.walking));
  assert.ok(clips.get(actions.backflip) > 2);
});
test("amethyst detours are small square bounce pads reachable from the main route over open air", () => {
  for (const map of maps) {
    const platforms = createPlatforms(map);
    const crystals = platforms.filter((p) => p.amethyst);
    assert.equal(crystals.length, 13);
    for (const pad of crystals) {
      assert.equal(pad.kind, "pad");
      assert.equal(pad.w, pad.d);
      assert.ok(pad.w < 4);
      const main = platforms.find((p) => p.d === 8 && p.z === pad.z + 1);
      assert.ok(main);
      const gap = Math.abs(main.x - pad.x) - (main.w + pad.w) / 2;
      assert.ok(
        gap > 5 && gap < 10,
        `${map.name}: risky but reachable double-jump gap`,
      );
      assert.ok(pad.y - main.y < 1);
      assert.ok(!pad.checkpoint);
    }
  }
});
test("optimized static assets retain valid indexed geometry at a playable triangle budget", () => {
  for (const name of [
    "ark11",
    "AmethystCluster",
    "ship1",
    "ship2",
    "ship3",
    "ship4",
  ]) {
    const { doc, bin } = readGlb(`../public/models/gameplay/${name}.glb`);
    let triangles = 0;
    for (const mesh of doc.meshes)
      for (const primitive of mesh.primitives) {
        const accessor = doc.accessors[primitive.indices];
        const view = doc.bufferViews[accessor.bufferView];
        const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const vertexCount = doc.accessors[primitive.attributes.POSITION].count;
        for (let i = 0; i < accessor.count; i++)
          assert.ok(bin.readUInt32LE(start + i * 4) < vertexCount, name);
        triangles += accessor.count / 3;
        for (const attribute of Object.values(primitive.attributes))
          assert.equal(doc.accessors[attribute].count, vertexCount);
      }
    assert.ok(triangles <= 60000, name);
    assert.ok(doc.images.length > 0, `${name}: preserve textures`);
  }
});

test("three additional flyers follow distinct, continuous routes across each district", () => {
  for (const map of maps) {
    const flyers = createFleet(map.seed, map.height).filter(
      (s) => s.role === "flyby",
    );
    assert.equal(flyers.length, 3);
    assert.equal(new Set(flyers.map((s) => s.flightPath)).size, 3);
    for (const ship of flyers) {
      let previous = patrolPosition(ship, 0);
      let minZ = Infinity,
        maxZ = -Infinity;
      for (let t = 0.05; t <= 100; t += 0.05) {
        const p = patrolPosition(ship, t);
        assert.ok(Object.values(p).every(Number.isFinite));
        assert.ok(
          Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z) < 1,
          "flyers must not teleport",
        );
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
        previous = p;
      }
      assert.ok(
        maxZ - minZ > 70,
        "flight routes cover more ground than sentry hovering",
      );
    }
  }
});
test("a single guardian starts over the first gem and transfers smoothly to uncollected gems", () => {
  for (const map of maps) {
    const guardians = createFleet(map.seed, map.height).filter(
      (s) => s.role === "guardian",
    );
    assert.equal(guardians.length, 1);
    const guardian = guardians[0];
    const gems = createPlatforms(map).flatMap((p, index) =>
      p.amethyst ? [{ index, x: p.x, y: p.y + 3, z: p.z }] : [],
    );
    const anchor = { x: guardian.x, y: guardian.y, z: guardian.z };
    assert.equal(anchor.x, gems[0].x);
    assert.ok(Math.abs(anchor.y - (gems[0].y + 9)) < 1e-10);
    assert.equal(anchor.z, gems[0].z);
    const collected = new Set([gems[0].index]);
    const step = advanceGuardianAnchor(anchor, gems, collected, gems[0], 0.05);
    assert.ok(
      Math.hypot(step.x - anchor.x, step.y - anchor.y, step.z - anchor.z) <=
        0.600001,
    );
    assert.notDeepEqual(step, anchor, "collected gem is no longer guarded");
    const target = advanceGuardianAnchor(anchor, gems, collected, gems[1], 100);
    assert.ok(
      Math.hypot(
        target.x - gems[1].x,
        target.y - gems[1].y - 9,
        target.z - gems[1].z,
      ) < 1e-8,
    );
    const all = new Set(gems.map((g) => g.index));
    assert.deepEqual(
      advanceGuardianAnchor(anchor, gems, all, gems[0], 1),
      anchor,
    );
    assert.deepEqual(
      advanceGuardianAnchor(anchor, gems, collected, gems[1], 0),
      anchor,
      "pause freezes transfers",
    );
    for (let t = 0; t < 40; t += 0.1) {
      const p = patrolPosition(guardian, t, anchor);
      assert.ok(
        Math.abs(Math.hypot(p.x - anchor.x, p.z - anchor.z) - 13) < 1e-8,
      );
      assert.ok(Math.abs(p.y - anchor.y) <= 1.6);
    }
  }
});
test("nearby amethyst guardian can engage without changing the global attacker cap or range", () => {
  const fleet = createFleet(3, 1),
    guardian = fleet.find((s) => s.role === "guardian"),
    sentry = fleet[0];
  const player = { x: 0, y: 0, z: 0 };
  assert.ok(
    attackPriority(guardian, { x: 40, y: 0, z: 0 }, player) <
      attackPriority(sentry, { x: 25, y: 0, z: 0 }, player),
  );
  assert.equal(attackPriority(sentry, { x: 25, y: 0, z: 0 }, player), 625);
  assert.equal(inEngagementRange({ x: 251, y: 0, z: 0 }, player), false);
  assert.equal(MAX_ATTACKERS, 3);
});

test("giant sky orbs cover every district without entering playable jump lanes", () => {
  for (const map of maps) {
    const orbs = createSkyOrbs(map);
    const platforms = createPlatforms(map);
    const ships = createFleet(map.seed, map.height);
    assert.equal(orbs.length, 9);
    assert.deepEqual(
      createSkyOrbs(map),
      orbs,
      "placement stays stable across restarts",
    );
    assert.ok(orbs.some((o) => o.x < 0) && orbs.some((o) => o.x > 0));
    assert.ok(orbs[0].z > -40);
    assert.ok(orbs.at(-1).z <= platforms.filter((p) => p.d === 8).at(-1).z);
    for (const orb of orbs) {
      assert.ok(orb.size >= Math.max(...ships.map((s) => s.size)) * 3);
      assert.ok(
        orb.y - orb.size / 2 - 1.2 > 45,
        "orbs float clear of rooftop structures",
      );
      assert.ok(
        Math.abs(orb.x) - orb.size / 2 > 35,
        "orbs do not obscure jump lanes or amethyst pads",
      );
      assert.ok(Object.values(orb).every(Number.isFinite));
    }
  }
});
