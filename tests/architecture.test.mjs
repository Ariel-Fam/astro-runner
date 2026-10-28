import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const file = readFileSync(
  new URL("../public/models/architecture/new-eden-kit-hq.glb", import.meta.url),
);
const gltf = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
const types = [
  "LimestoneTower",
  "GlassTower",
  "TerraceApartments",
  "BrickWorks",
];
const primitiveFor = (name) => {
  const node = gltf.nodes.find((n) => n.name === name);
  assert.ok(node, `Missing runtime node ${name}`);
  const mesh = gltf.meshes[node.mesh];
  assert.equal(mesh.primitives.length, 1);
  return mesh.primitives[0];
};

test("enhanced Blender kit has complete PBR maps within its shared asset budget", () => {
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.ok(file.length < 2_500_000, `Kit grew to ${file.length} bytes`);
  assert.equal(gltf.meshes.length, 8);
  assert.equal(gltf.materials.length, 1);
  assert.equal(gltf.images.length, 4);
  assert.equal(gltf.animations?.length ?? 0, 0);
  const material = gltf.materials[0];
  assert.ok(material.normalTexture);
  assert.ok(material.emissiveTexture);
  assert.ok(material.pbrMetallicRoughness.baseColorTexture);
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.equal(material.alphaMode ?? "OPAQUE", "OPAQUE");
  assert.equal(material.doubleSided ?? false, false);
});

test("each building has a cheaper distant mesh with matching placement bounds", () => {
  for (const name of types) {
    const high = primitiveFor(name);
    const low = primitiveFor(`${name}_LOD`);
    const highTriangles = gltf.accessors[high.indices].count / 3;
    const lowTriangles = gltf.accessors[low.indices].count / 3;
    assert.ok(highTriangles <= 11_000, `${name}: nearby geometry over budget`);
    assert.ok(lowTriangles <= 3000, `${name}: distant geometry over budget`);
    assert.ok(
      lowTriangles < highTriangles * 0.35,
      `${name}: LOD does not save enough geometry`,
    );
    for (const primitive of [high, low]) {
      assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
      assert.ok(primitive.attributes.NORMAL !== undefined);
      assert.equal(primitive.material, 0);
    }
    const a = gltf.accessors[high.attributes.POSITION];
    const b = gltf.accessors[low.attributes.POSITION];
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(a.min[axis] - b.min[axis]) < 0.1);
      assert.ok(Math.abs(a.max[axis] - b.max[axis]) < 0.1);
    }
  }
});
