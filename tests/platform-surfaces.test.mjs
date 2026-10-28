import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
async function loadSource(path) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    },
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}
const { platformRoofData } = await loadSource("../data/platformSurfaces.ts");
const { maps, createPlatforms } = await loadSource("../data/maps.ts");

test("district roof geometry exactly covers every playable platform with upward-facing triangles", () => {
  for (const map of maps) {
    for (const p of createPlatforms(map)) {
      const data = platformRoofData(p.w, p.d, map.id);
      let area = 0;
      for (let i = 0; i < data.indices.length; i += 3) {
        const [a, b, c] = data.indices
          .slice(i, i + 3)
          .map((index) => data.positions.slice(index * 3, index * 3 + 3));
        const crossY =
          (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        assert.ok(crossY > 0);
        area += crossY / 2;
      }
      assert.ok(Math.abs(area - p.w * p.d) < 1e-6);
      for (let i = 0; i < data.positions.length; i += 3) {
        assert.equal(data.positions[i + 1], 0);
        assert.ok(Math.abs(data.positions[i]) <= p.w / 2 + 1e-8);
        assert.ok(Math.abs(data.positions[i + 2]) <= p.d / 2 + 1e-8);
      }
      const tile = Number(map.id) - 1;
      for (let i = 0; i < data.uvs.length; i += 2) {
        const u = data.uvs[i] * 1024,
          v = (1 - data.uvs[i + 1]) * 512;
        assert.ok(u >= (tile % 4) * 256 + 1.9 && u <= (tile % 4) * 256 + 254.1);
        assert.ok(
          v >= Math.floor(tile / 4) * 256 + 1.9 &&
            v <= Math.floor(tile / 4) * 256 + 254.1,
        );
      }
    }
  }
});

test("Blender platform finishes share one opaque PBR material under 750KB", () => {
  const file = readFileSync(
    new URL(
      "../public/models/architecture/platform-surfaces.glb",
      import.meta.url,
    ),
  );
  assert.ok(file.length < 750_000);
  const gltf = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
  assert.ok(gltf.nodes.some((n) => n.name === "PlatformSurfacePalette"));
  assert.equal(gltf.materials.length, 1);
  assert.equal(gltf.images.length, 4);
  assert.ok(gltf.materials[0].normalTexture);
  assert.ok(gltf.materials[0].pbrMetallicRoughness.metallicRoughnessTexture);
  assert.equal(gltf.materials[0].alphaMode ?? "OPAQUE", "OPAQUE");
});
