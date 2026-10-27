// Preserve supplied originals; produce lighter static gameplay copies.
import fs from "node:fs";
import { MeshoptSimplifier as simplify } from "meshoptimizer";
await simplify.ready;
const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
for (const name of [
  "ark11",
  "AmethystCluster",
  "ship1",
  "ship2",
  "ship3",
  "ship4",
]) {
  const file = fs.readFileSync(`public/models/${name}.glb`);
  const jsonLength = file.readUInt32LE(12);
  const doc = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
  const bin = file.subarray(28 + jsonLength);
  const views = doc.bufferViews.map((v) =>
    bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength),
  );
  function accessorData(id) {
    const a = doc.accessors[id],
      view = doc.bufferViews[a.bufferView];
    const size = width[a.type] * bytes[a.componentType],
      stride = view.byteStride ?? size;
    const packed = Buffer.alloc(a.count * size),
      source = views[a.bufferView];
    for (let i = 0; i < a.count; i++)
      source.copy(
        packed,
        i * size,
        (a.byteOffset ?? 0) + i * stride,
        (a.byteOffset ?? 0) + i * stride + size,
      );
    return packed;
  }
  function replace(id, data, count) {
    const a = doc.accessors[id];
    a.bufferView = views.length;
    a.byteOffset = 0;
    a.count = count;
    views.push(data);
    doc.bufferViews.push({ buffer: 0, byteLength: data.length });
  }
  let before = 0,
    after = 0;
  for (const mesh of doc.meshes)
    for (const p of mesh.primitives) {
      const positions = accessorData(p.attributes.POSITION);
      const positionArray = new Float32Array(
        positions.buffer,
        positions.byteOffset,
        positions.length / 4,
      );
      const raw = accessorData(p.indices),
        a = doc.accessors[p.indices];
      const indices = Uint32Array.from(
        a.componentType === 5123
          ? new Uint16Array(raw.buffer, raw.byteOffset, raw.length / 2)
          : new Uint32Array(raw.buffer, raw.byteOffset, raw.length / 4),
      );
      const target = Math.min(indices.length, 60000 * 3);
      const [reduced] = simplify.simplify(
        indices,
        positionArray,
        3,
        target,
        0.004,
        ["LockBorder"],
      );
      before += indices.length / 3;
      after += reduced.length / 3;
      const [remap, count] = simplify.compactMesh(reduced);
      for (const id of Object.values(p.attributes)) {
        const a = doc.accessors[id],
          packed = accessorData(id),
          size = width[a.type] * bytes[a.componentType];
        const compact = Buffer.alloc(count * size);
        for (let i = 0; i < remap.length; i++)
          if (remap[i] !== 0xffffffff)
            packed.copy(compact, remap[i] * size, i * size, (i + 1) * size);
        replace(id, compact, count);
        // Position bounds are conservative and stay valid after simplification.
      }
      a.componentType = 5125;
      delete a.min;
      delete a.max;
      replace(
        p.indices,
        Buffer.from(reduced.buffer, reduced.byteOffset, reduced.byteLength),
        reduced.length,
      );
    }
  const used = new Set(
    [
      ...doc.accessors.map((a) => a.bufferView),
      ...(doc.images ?? []).map((i) => i.bufferView),
    ].filter((v) => v !== undefined),
  );
  const mapping = new Map();
  const chunks = [];
  let offset = 0;
  doc.bufferViews = [...used].map((old) => {
    mapping.set(old, mapping.size);
    const data = views[old],
      padding = (4 - (data.length % 4)) % 4;
    const result = { buffer: 0, byteOffset: offset, byteLength: data.length };
    chunks.push(data, Buffer.alloc(padding));
    offset += data.length + padding;
    return result;
  });
  for (const a of doc.accessors)
    if (a.bufferView !== undefined) a.bufferView = mapping.get(a.bufferView);
  for (const i of doc.images ?? [])
    if (i.bufferView !== undefined) i.bufferView = mapping.get(i.bufferView);
  doc.buffers = [{ byteLength: offset }];
  const json = Buffer.from(JSON.stringify(doc)),
    jsonPad = Buffer.alloc((4 - (json.length % 4)) % 4, 32),
    jsonSize = json.length + jsonPad.length;
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonSize + offset, 8);
  header.writeUInt32LE(jsonSize, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(offset);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.mkdirSync("public/models/gameplay", { recursive: true });
  fs.writeFileSync(
    `public/models/gameplay/${name}.glb`,
    Buffer.concat([header, json, jsonPad, binHeader, ...chunks]),
  );
  console.log(`${name}: ${before} → ${after} triangles`);
}
