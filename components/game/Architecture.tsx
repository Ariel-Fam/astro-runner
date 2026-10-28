"use client";

import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapConfig } from "@/data/maps";
import {
  BUILDING_TYPES,
  CITY_GROUND_Y,
  CITY_ORIGIN_Z,
  CITY_BLOCK_LENGTH,
  cityBlocks,
  type BuildingPlacement,
} from "@/data/city";

const KIT = "/models/architecture/new-eden-kit-hq.glb";
function BuildingBatch({
  geometry,
  material,
  placements,
  originZ,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placements: BuildingPlacement[];
  originZ: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    placements.forEach((p, i) => {
      // Keep the original city footprint and ground elevation. Rotation swaps
      // width and depth, so every building stays clear of the playable route.
      const quarterTurn = Math.abs(Math.sin(p.rotation)) > 0.5;
      transform.position.set(p.x, CITY_GROUND_Y, p.z - originZ);
      transform.rotation.set(0, p.rotation, 0);
      transform.scale.set(
        quarterTurn ? p.d : p.w,
        p.h,
        quarterTurn ? p.w : p.d,
      );
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [placements, originZ]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, placements.length]}
      // Scenery receives light but does not repeat the city in the shadow pass
      // or participate in combat/camera raycasts. Gameplay decks retain theirs.
      receiveShadow
      raycast={() => {}}
    />
  );
}

/** Three.js switches these static batches with distance and hysteresis. */
function BuildingBlock({
  high,
  low,
  material,
  placements,
  originZ,
}: {
  high: THREE.BufferGeometry;
  low: THREE.BufferGeometry;
  material: THREE.Material;
  placements: BuildingPlacement[];
  originZ: number;
}) {
  const ref = useRef<THREE.LOD>(null);
  useLayoutEffect(() => {
    const lod = ref.current;
    if (!lod) return;
    lod.levels.length = 0;
    lod.addLevel(lod.children[0], 0);
    lod.addLevel(lod.children[1], 155, 0.12);
  }, []);
  return (
    <lOD ref={ref} position={[0, 0, originZ]}>
      <group>
        <BuildingBatch
          geometry={high}
          material={material}
          placements={placements}
          originZ={originZ}
        />
      </group>
      <group>
        <BuildingBatch
          geometry={low}
          material={material}
          placements={placements}
          originZ={originZ}
        />
      </group>
    </lOD>
  );
}

export default function Architecture({ map }: { map: MapConfig }) {
  const { scene } = useGLTF(KIT);
  const { gl } = useThree();
  const blocks = useMemo(() => cityBlocks(map), [map]);
  const kit = useMemo(() => {
    scene.updateMatrixWorld(true);
    const normalized = (name: string) => {
      const source = scene.getObjectByName(name) as THREE.Mesh | undefined;
      if (!source?.isMesh) throw new Error(`Architecture kit missing ${name}`);
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -bounds.min.y, -center.z);
      geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return { geometry, source };
    };
    return BUILDING_TYPES.map((name) => {
      const high = normalized(name);
      const low = normalized(`${name}_LOD`);
      const material = (
        high.source.material as THREE.MeshStandardMaterial
      ).clone();
      material.color.set(map.concrete).lerp(new THREE.Color("white"), 0.94);
      material.emissiveIntensity = ["02", "05", "06"].includes(map.id)
        ? 1.1
        : 0.35;
      return { high: high.geometry, low: low.geometry, material };
    });
  }, [scene, map.concrete, map.id]);
  useEffect(() => {
    // Keep oblique facades sharp without raising the whole scene's pixel ratio.
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    kit.forEach(({ material }) => {
      [
        material.map,
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.emissiveMap,
      ].forEach((texture) => {
        if (texture && texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      });
    });
  }, [kit, gl]);
  useEffect(
    () => () => {
      kit.forEach(({ high, low, material }) => {
        high.dispose();
        low.dispose();
        material.dispose();
      });
    },
    [kit],
  );
  return (
    <group name="Blender architecture">
      {blocks.flatMap((types, block) =>
        types.map((placements, type) =>
          placements.length ? (
            <BuildingBlock
              key={`${block}-${type}`}
              high={kit[type].high}
              low={kit[type].low}
              material={kit[type].material}
              placements={placements}
              originZ={CITY_ORIGIN_Z - (block + 0.5) * CITY_BLOCK_LENGTH}
            />
          ) : null,
        ),
      )}
    </group>
  );
}
