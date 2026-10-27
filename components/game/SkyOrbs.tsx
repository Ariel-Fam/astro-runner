"use client";
import { useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createSkyOrbs, type MapConfig, type SkyOrb } from "@/data/maps";
import { prepareModel } from "./modelUtils";
function FloatingOrb({
  source,
  orb,
  timeRef,
}: {
  source: THREE.Object3D;
  orb: SkyOrb;
  timeRef: React.RefObject<number>;
}) {
  const root = useRef<THREE.Group>(null);
  const { model, bounds } = useMemo(() => {
    const prepared = prepareModel(source);
    prepared.model.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.raycast = () => {};
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        const surface = material as THREE.MeshStandardMaterial;
        if (!surface.isMeshStandardMaterial) continue;
        // Retain the supplied logo texture while keeping the white finish readable at night.
        surface.fog = false;
        surface.metalness = 0.08;
        surface.roughness = 0.6;
        surface.emissive.set("#ffffff");
        surface.emissiveMap = surface.map;
        surface.emissiveIntensity = 0.18;
      }
    });
    return prepared;
  }, [source]);
  const scale =
    orb.size /
    Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 0.001);
  const center = bounds.getCenter(new THREE.Vector3()).multiplyScalar(-1);
  useFrame(({ camera }) => {
    if (!root.current) return;
    root.current.position.y =
      orb.y + Math.sin(timeRef.current * 0.35 + orb.phase) * 1.2;
    root.current.lookAt(camera.position);
  });
  return (
    <group ref={root} position={[orb.x, orb.y, orb.z]}>
      {/* The supplied model's logo faces local +X; turn it onto lookAt's +Z axis. */}
      <group rotation={[0, -Math.PI / 2, 0]} scale={scale}>
        <primitive object={model} position={center} />
      </group>
    </group>
  );
}
export default function SkyOrbs({
  map,
  timeRef,
}: {
  map: MapConfig;
  timeRef: React.RefObject<number>;
}) {
  const { scene } = useGLTF("/models/White%20Orb.glb");
  const orbs = useMemo(() => createSkyOrbs(map), [map]);
  return (
    <group>
      {orbs.map((orb, index) => (
        <FloatingOrb key={index} source={scene} orb={orb} timeRef={timeRef} />
      ))}
    </group>
  );
}
