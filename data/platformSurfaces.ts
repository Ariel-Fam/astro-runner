/** Blender atlas layout: eight 256px finishes in a 1024×512 texture. */
export function platformRoofData(width: number, depth: number, mapId: string) {
  const theme = Math.max(0, Math.min(7, Number.parseInt(mapId, 10) - 1 || 0));
  const ox = (theme % 4) * 256;
  const oy = Math.floor(theme / 4) * 256;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // Repeat at a physical 4m scale instead of stretching one image over a deck.
  for (let z = 0; z < depth; z += 4) {
    for (let x = 0; x < width; x += 4) {
      const w = Math.min(4, width - x);
      const d = Math.min(4, depth - z);
      const base = positions.length / 3;
      for (const [u, v] of [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ]) {
        positions.push(x + u * w - width / 2, 0, z + v * d - depth / 2);
        normals.push(0, 1, 0);
        // Blender-exported textures use flipped glTF V coordinates.
        uvs.push(
          (ox + 2 + u * (w / 4) * 252) / 1024,
          1 - (oy + 2 + v * (d / 4) * 252) / 512,
        );
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return { positions, normals, uvs, indices };
}
