import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

async function loadSource(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}

const { cityBlocks, CITY_ORIGIN_Z, CITY_BLOCK_LENGTH } =
  await loadSource("../data/city.ts");
const { maps } = await loadSource("../data/maps.ts");

test("all district buildings leave the street carriageways and crossings clear", () => {
  for (const map of maps) {
    const blocks = cityBlocks(map);
    assert.equal(blocks.flat(2).length, 156);
    blocks.forEach((types, block) => {
      const start = CITY_ORIGIN_Z - block * CITY_BLOCK_LENGTH;
      for (const p of types.flat()) {
        assert.ok(
          Math.abs(p.x) - p.w / 2 > 12.3,
          `${map.id}: boulevard overlap`,
        );
        assert.ok(
          Math.abs(p.x) + p.w / 2 < 140,
          `${map.id}: service road overlap`,
        );
        assert.ok(
          p.z + p.d / 2 <= start - 14 + 1e-8,
          `${map.id}: crossing overlap`,
        );
        assert.ok(
          p.z - p.d / 2 >= start - CITY_BLOCK_LENGTH + 14 - 1e-8,
          `${map.id}: crossing overlap`,
        );
      }
    });
  }
});

test("street module uses one opaque draw primitive within the texture and geometry budgets", () => {
  const file = readFileSync(
    new URL(
      "../public/models/architecture/new-eden-streets.glb",
      import.meta.url,
    ),
  );
  assert.ok(file.length < 450_000);
  const gltf = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
  assert.equal(gltf.meshes.length, 1);
  assert.equal(gltf.meshes[0].name, "StreetBlock");
  assert.equal(gltf.meshes[0].primitives.length, 1);
  assert.equal(gltf.materials.length, 1);
  assert.equal(gltf.images.length, 1);
  assert.equal(gltf.materials[0].alphaMode ?? "OPAQUE", "OPAQUE");
  const primitive = gltf.meshes[0].primitives[0];
  assert.ok(gltf.accessors[primitive.indices].count / 3 < 2000);
  const positions = gltf.accessors[primitive.attributes.POSITION];
  // Blender's Z-up geometry is exported as Y-up; no downward hanging scenery.
  assert.ok(positions.min[1] > -0.1);
  assert.ok(positions.max[1] < 7);
  assert.ok(positions.min[2] <= -105);
  assert.ok(positions.max[2] >= 12);
});
