"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { platformRoofData } from "@/data/platformSurfaces";

/** The playable rooftops use the same Blender PBR palette as the skyline. */
export default function BuildingSurface({
  position,
  size,
  mapId,
  platform = true,
}: {
  position: [number, number, number];
  size: [number, number, number];
  mapId: string;
  platform?: boolean;
}) {
  const { scene } = useGLTF("/models/architecture/new-eden-kit-hq.glb");
  const { scene: palette } = useGLTF(
    "/models/architecture/platform-surfaces.glb",
  );
  const roofMaterial = (
    palette.getObjectByName("PlatformSurfacePalette") as THREE.Mesh
  ).material;
  const material = (scene.getObjectByName("LimestoneTower") as THREE.Mesh)
    .material;
  const [width, height, depth] = size;
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(width, height, depth);
    const uv = box.getAttribute("uv");
    for (let face = 0; face < 6; face++) {
      const top = face === 2;
      const bottom = face === 3;
      const tile = top
        ? [512, 768, 512, 256]
        : bottom
          ? [960, 704, 1, 1]
          : [
              0,
              0,
              Math.min(512, ((face < 2 ? depth : width) / 12) * 512),
              Math.min(512, (height / 28) * 512),
            ];
      for (let corner = 0; corner < 4; corner++) {
        const i = face * 4 + corner;
        uv.setXY(
          i,
          (tile[0] + 2 + uv.getX(i) * Math.max(1, tile[2] - 4)) / 1024,
          1 - (tile[1] + 2 + uv.getY(i) * Math.max(1, tile[3] - 4)) / 1024,
        );
      }
    }
    if (platform) {
      // The roof uses its district finish; leave its exact top face for that mesh.
      const indices = Array.from(box.index!.array);
      box.setIndex(indices.filter((_, i) => i < 12 || i >= 18));
      box.clearGroups();
    }
    return box;
  }, [width, height, depth, platform]);
  const roof = useMemo(() => {
    if (!platform) return null;
    const data = platformRoofData(width, depth, mapId);
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.positions, 3),
    );
    mesh.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(data.normals, 3),
    );
    mesh.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
    mesh.setIndex(data.indices);
    return mesh;
  }, [width, depth, mapId, platform]);
  useEffect(() => () => roof?.dispose(), [roof]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      position={position}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      dispose={null}
      userData={{ combatSolid: true, cameraSolid: true }}
    >
      {roof && (
        <mesh
          position={[0, height / 2, 0]}
          geometry={roof}
          material={roofMaterial}
          castShadow
          receiveShadow
          dispose={null}
          userData={{ combatSolid: true, cameraSolid: true }}
        />
      )}
    </mesh>
  );
}
