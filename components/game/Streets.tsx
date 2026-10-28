"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CITY_BLOCK_LENGTH, CITY_GROUND_Y, CITY_ORIGIN_Z } from "@/data/city";

// Extra blocks at both ends carry the street beyond the skyline's boundaries.
const STREET_BLOCKS = 8;

export default function Streets() {
  const { scene } = useGLTF("/models/architecture/new-eden-streets.glb");
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geometry, material } = useMemo(() => {
    scene.updateMatrixWorld(true);
    const source = scene.getObjectByName("StreetBlock") as THREE.Mesh;
    if (!source?.isMesh) throw new Error("Street kit missing StreetBlock");
    return {
      geometry: source.geometry.clone().applyMatrix4(source.matrixWorld),
      material: source.material,
    };
  }, [scene]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Matrix4();
    for (let i = 0; i < STREET_BLOCKS; i++) {
      transform.makeTranslation(
        0,
        CITY_GROUND_Y,
        CITY_ORIGIN_Z + CITY_BLOCK_LENGTH - i * CITY_BLOCK_LENGTH,
      );
      mesh.setMatrixAt(i, transform);
    }
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [geometry]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <instancedMesh
      name="Blender roads and paving"
      ref={ref}
      args={[geometry, material, STREET_BLOCKS]}
      receiveShadow
      raycast={() => {}}
    />
  );
}
