"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  createFleet,
  patrolPosition,
  advanceGuardianAnchor,
  attackPriority,
  inEngagementRange,
  segmentSphere,
  MAX_ATTACKERS,
  ENEMY_DAMAGE,
  PLAYER_FIRE_INTERVAL,
  SHIP_SHIELD_HITS,
} from "@/data/combat";
import { prepareModel } from "./modelUtils";
import type { MapConfig, Platform } from "@/data/maps";
import { gameAudio } from "./audio";
export type CombatState = {
  grounded: boolean;
  dead: boolean;
  time: number;
  amethystUntil: number;
  crystals: Set<number>;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  aiming: boolean;
  firing: boolean;
  fireQueued: boolean;
  health: number;
  shieldUntil: number;
  hitUntil: number;
  kills: number;
  threats: number;
  respawns: number;
  clear: number;
  ready: boolean;
  poseReady: boolean;
};
export function createCombatState(): CombatState {
  return {
    grounded: true,
    dead: false,
    time: 0,
    amethystUntil: 0,
    crystals: new Set(),
    position: new THREE.Vector3(0, 0, 10),
    velocity: new THREE.Vector3(),
    yaw: 0,
    aiming: false,
    firing: false,
    fireQueued: false,
    health: 100,
    shieldUntil: 6,
    hitUntil: 0,
    kills: 0,
    threats: 0,
    respawns: 0,
    clear: 0,
    ready: false,
    poseReady: false,
  };
}
type Bullet = {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  enemy: boolean;
};
type FleetShip = ReturnType<typeof createFleet>[number] & {
  hp: number;
  nextShot: number;
  charge: boolean;
  p: THREE.Vector3;
  heading: THREE.Vector3;
  hitUntil: number;
};
const MAX_BULLETS = 96;
function ShipModel({
  id,
  size,
  loadedRef,
}: {
  id: number;
  size: number;
  loadedRef: React.RefObject<Set<number>>;
}) {
  const { scene } = useGLTF(`/models/gameplay/ship${(id % 4) + 1}.glb`);
  const { model, bounds } = useMemo(() => {
    const prepared = prepareModel(scene);
    prepared.model.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    return prepared;
  }, [scene]);
  const scale =
    size / Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 0.001);
  const center = bounds.getCenter(new THREE.Vector3());
  useEffect(() => {
    const loaded = loadedRef.current;
    loaded.add(id);
    return () => {
      loaded.delete(id);
    };
  }, [id, loadedRef]);
  return (
    <group scale={scale}>
      <primitive object={model} position={center.multiplyScalar(-1)} />
    </group>
  );
}
export function ShootingPose({
  combatRef,
}: {
  combatRef: React.RefObject<CombatState>;
}) {
  const { scene } = useGLTF("/models/shootingPose.glb");
  const { model, bounds } = useMemo(() => prepareModel(scene), [scene]);
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    const combat = combatRef.current;
    combat.poseReady = true;
    return () => {
      combat.poseReady = false;
    };
  }, [combatRef]);
  const scale = 1.85 / Math.max(bounds.max.y - bounds.min.y, 0.01);
  useFrame(() => {
    if (root.current)
      root.current.visible =
        combatRef.current.aiming && combatRef.current.grounded;
  });
  return (
    <group ref={root} visible={false}>
      <group scale={scale}>
        <primitive object={model} position={[0, -bounds.min.y, 0]} />
      </group>
    </group>
  );
}
export default function Combat({
  platforms,
  map,
  paused,
  combatRef,
  timeRef,
}: {
  map: MapConfig;
  platforms: Platform[];
  paused: boolean;
  combatRef: React.RefObject<CombatState>;
  timeRef: React.RefObject<number>;
}) {
  const { camera, scene } = useThree();
  const shipRefs = useRef<(THREE.Group | null)[]>([]);
  const forceRefs = useRef<(THREE.Mesh | null)[]>([]);
  const chargeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bulletMesh = useRef<THREE.InstancedMesh>(null);
  const blastMesh = useRef<THREE.InstancedMesh>(null);
  const patrols = useMemo(() => createFleet(map.seed, map.height), [map]);
  const gems = useMemo(
    () =>
      platforms.flatMap((p, index) =>
        p.amethyst ? [{ index, x: p.x, y: p.y + 3, z: p.z }] : [],
      ),
    [platforms],
  );
  const loadedRef = useRef(new Set<number>());
  const runtime = useRef({
    fleet: patrols.map((s): FleetShip => ({
      ...s,
      hp: SHIP_SHIELD_HITS + 1,
      nextShot: 8 + s.id * 1.35,
      charge: false,
      p: new THREE.Vector3(),
      heading: new THREE.Vector3(),
      hitUntil: 0,
    })),
    bullets: [] as Bullet[],
    blasts: [] as { p: THREE.Vector3; age: number }[],
    guardianAnchor: {
      x: patrols.at(-1)!.x,
      y: patrols.at(-1)!.y,
      z: patrols.at(-1)!.z,
    },
    lastFire: -1,
    lastTime: 0,
    clear: 0,
    colliders: [] as THREE.Object3D[],
    initialized: false,
  });
  const ray = useRef(new THREE.Raycaster());
  const matrix = useRef(new THREE.Object3D());
  useFrame(() => {
    const c = combatRef.current,
      r = runtime.current,
      t = timeRef.current;
    const fleet = r.fleet;
    const delta = Math.min(0.05, Math.max(0, t - r.lastTime));
    r.lastTime = t;
    if (paused || c.dead) return;
    if (!r.initialized) {
      scene.traverse((o) => {
        if (o.userData.combatSolid) r.colliders.push(o);
      });
      r.initialized = true;
    }
    if (!c.ready && loadedRef.current.size === fleet.length) {
      c.ready = true;
      for (const ship of fleet)
        ship.nextShot =
          t +
          5 +
          (ship.role === "sentry" ? ship.id * 1.35 : (ship.id - 22) * 0.9);
    }
    if (c.clear !== r.clear) {
      r.bullets = [];
      r.clear = c.clear;
    }
    const wallDistance = (a: THREE.Vector3, b: THREE.Vector3) => {
      const d = b.clone().sub(a);
      const len = d.length();
      if (len < 0.00001) return Infinity;
      ray.current.set(a, d.normalize());
      ray.current.far = len;
      return (
        ray.current.intersectObjects(r.colliders, false)[0]?.distance ??
        Infinity
      );
    };
    const playerCenter = c.position.clone().add(new THREE.Vector3(0, 1, 0));
    r.guardianAnchor = advanceGuardianAnchor(
      r.guardianAnchor,
      gems,
      c.crystals,
      playerCenter,
      delta,
    );
    for (const ship of fleet) {
      const p = patrolPosition(ship, t, r.guardianAnchor);
      ship.heading.set(p.x - ship.p.x, 0, p.z - ship.p.z);
      ship.p.set(p.x, p.y, p.z);
    }
    const attackers = fleet
      .filter((s) => s.hp > 0 && inEngagementRange(s.p, playerCenter))
      .sort(
        (a, b) =>
          attackPriority(a, a.p, playerCenter) -
          attackPriority(b, b.p, playerCenter),
      )
      .slice(0, MAX_ATTACKERS);
    c.threats = c.ready ? attackers.length : 0;
    const nearestShip = fleet
      .filter((s) => s.hp > 0)
      .reduce(
        (distance, s) => Math.min(distance, s.p.distanceTo(playerCenter)),
        Infinity,
      );
    gameAudio.loop("hover", Math.max(0, 1 - nearestShip / 100) * 0.32);
    for (const ship of fleet) {
      const root = shipRefs.current[ship.id];
      if (root) {
        root.visible = ship.hp > 0;
        root.position.copy(ship.p);
        if (ship.role === "sentry") {
          root.lookAt(
            ship.p
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(t * 0.16 + ship.phase),
                  0,
                  -Math.sin(t * 0.16 + ship.phase),
                ),
              ),
          );
        } else if (ship.heading.lengthSq() > 1e-8) {
          root.lookAt(
            ship.p.x + ship.heading.x,
            ship.p.y,
            ship.p.z + ship.heading.z,
          );
        } else {
          const ahead = patrolPosition(ship, t + 0.15, r.guardianAnchor);
          root.lookAt(ahead.x, ship.p.y, ahead.z);
        }
      }
      const force = forceRefs.current[ship.id];
      if (force) {
        force.visible = ship.hp > 1;
        (force.material as THREE.MeshBasicMaterial).opacity =
          t < ship.hitUntil ? 0.45 : 0.08 + (ship.hp - 1) * 0.025;
      }
      const active =
        c.ready &&
        attackers.includes(ship) &&
        inEngagementRange(ship.p, playerCenter);
      if (!active) ship.nextShot = Math.max(ship.nextShot, t + 1.2);
      ship.charge =
        c.ready &&
        ship.hp > 0 &&
        attackers.includes(ship) &&
        inEngagementRange(ship.p, playerCenter) &&
        t >= ship.nextShot - 1.1;
      const light = chargeRefs.current[ship.id];
      if (light) {
        light.visible = ship.charge || t < ship.hitUntil;
        (light.material as THREE.MeshBasicMaterial).color.set(
          t < ship.hitUntil ? "#8af6ff" : "#ff6044",
        );
        light.scale.setScalar(
          0.6 + Math.max(0, 1.1 - (ship.nextShot - t)) * 1.1,
        );
      }
      if (
        !c.ready ||
        ship.hp <= 0 ||
        !attackers.includes(ship) ||
        !inEngagementRange(ship.p, playerCenter)
      )
        continue;
      if (t >= ship.nextShot) {
        ship.nextShot =
          t + (2.85 + (ship.id % 3) * 0.425) / (1.15 * 1.15 * 1.09);
        const muzzle = ship.p.clone().add(new THREE.Vector3(0, -2, 0));
        const aim = playerCenter.clone().addScaledVector(c.velocity, 0.18);
        if (
          wallDistance(muzzle, aim) >= muzzle.distanceTo(aim) - 1 &&
          r.bullets.length < MAX_BULLETS
        ) {
          gameAudio.shot(
            "ship",
            Math.max(0.08, 1 - ship.p.distanceTo(playerCenter) / 250) * 0.5,
          );
          r.bullets.push({
            p: muzzle,
            v: aim.sub(muzzle).normalize().multiplyScalar(29),
            age: 0,
            enemy: true,
          });
        }
      }
    }
    if (c.aiming && c.firing && t - r.lastFire >= PLAYER_FIRE_INTERVAL) {
      r.lastFire = t;
      gameAudio.shot("character", 0.65);
      c.fireQueued = false;
      // Match the reference: shoulder muzzle converges on the camera crosshair.
      const muzzle = new THREE.Vector3(0.32, 1.15, 1.05)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw + Math.PI)
        .add(c.position);
      const forward = camera.getWorldDirection(new THREE.Vector3());
      const far = camera.position.clone().addScaledVector(forward, 250);
      ray.current.set(camera.position, forward);
      ray.current.far = 250;
      let target =
        ray.current.intersectObjects(r.colliders, false)[0]?.point.clone() ??
        far;
      let nearest = camera.position.distanceTo(target);
      for (const ship of fleet) {
        if (ship.hp <= 0) continue;
        const hit = segmentSphere(
          camera.position,
          far,
          ship.p,
          ship.size * 0.38,
        );
        if (hit !== null && hit * 250 < nearest) {
          nearest = hit * 250;
          target = camera.position.clone().addScaledVector(forward, nearest);
        }
      }
      if (r.bullets.length < MAX_BULLETS)
        r.bullets.push({
          p: muzzle,
          v: target.sub(muzzle).normalize().multiplyScalar(155),
          age: 0,
          enemy: false,
        });
    }
    r.bullets = r.bullets.filter((b) => {
      const old = b.p.clone();
      b.age += delta;
      b.p.addScaledVector(b.v, delta);
      if (b.age > (b.enemy ? 12 : 2.4)) return false;
      const length = old.distanceTo(b.p);
      let hitDistance = Infinity;
      let target: FleetShip | undefined;
      if (b.enemy) {
        const hit = segmentSphere(old, b.p, playerCenter, 0.72);
        if (hit !== null) hitDistance = hit * length;
      } else
        for (const ship of fleet) {
          if (ship.hp <= 0) continue;
          const hit = segmentSphere(old, b.p, ship.p, ship.size * 0.38);
          if (hit !== null && hit * length < hitDistance) {
            hitDistance = hit * length;
            target = ship;
          }
        }
      const wall = wallDistance(old, b.p);
      if (wall < length && wall < hitDistance) return false;
      if (hitDistance !== Infinity) {
        if (b.enemy) {
          gameAudio.shot("impact", 0.85);
          if (t >= c.shieldUntil) {
            c.health = Math.max(0, c.health - ENEMY_DAMAGE);
            c.hitUntil = t + 0.35;
            c.shieldUntil = t + 0.65;
          }
        } else if (target) {
          gameAudio.shot("impact", 0.65);
          target.hp--;
          target.hitUntil = t + 0.2;
          r.blasts.push({ p: b.p.clone(), age: 0.35 });
          if (target.hp <= 0) {
            c.kills++;
            r.blasts.push({ p: target.p.clone(), age: 0 });
          }
        }
        return false;
      }
      return true;
    });
    const dummy = matrix.current;
    if (bulletMesh.current) {
      bulletMesh.current.count = r.bullets.length;
      r.bullets.forEach((b, i) => {
        dummy.position.copy(b.p);
        dummy.scale.setScalar(b.enemy ? 0.38 : 0.12);
        dummy.updateMatrix();
        bulletMesh.current!.setMatrixAt(i, dummy.matrix);
        bulletMesh.current!.setColorAt(
          i,
          new THREE.Color(b.enemy ? "#ff5646" : "#7ef6ff"),
        );
      });
      bulletMesh.current.instanceMatrix.needsUpdate = true;
      if (bulletMesh.current.instanceColor)
        bulletMesh.current.instanceColor.needsUpdate = true;
    }
    r.blasts = r.blasts.filter((b) => (b.age += delta) < 0.65).slice(-24);
    if (blastMesh.current) {
      blastMesh.current.count = r.blasts.length;
      r.blasts.forEach((b, i) => {
        dummy.position.copy(b.p);
        dummy.scale.setScalar(0.4 + b.age * 9);
        dummy.updateMatrix();
        blastMesh.current!.setMatrixAt(i, dummy.matrix);
      });
      blastMesh.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group>
      {patrols.map((ship) => (
        <group
          key={ship.id}
          ref={(el) => {
            shipRefs.current[ship.id] = el;
          }}
        >
          <Suspense
            fallback={
              <mesh>
                <octahedronGeometry args={[ship.size * 0.25]} />
                <meshStandardMaterial color="#35464e" wireframe />
              </mesh>
            }
          >
            <ShipModel id={ship.id} size={ship.size} loadedRef={loadedRef} />
          </Suspense>
          <mesh
            ref={(el) => {
              forceRefs.current[ship.id] = el;
            }}
            scale={[1, 0.55, 1]}
          >
            <sphereGeometry args={[ship.size * 0.43, 24, 16]} />
            <meshBasicMaterial
              color={ship.role === "guardian" ? "#e279ff" : "#9c9dff"}
              transparent
              opacity={0.14}
              wireframe
              depthWrite={false}
            />
          </mesh>
          {ship.role === "guardian" && (
            <mesh position={[0, -4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[4.8, 0.09, 6, 48]} />
              <meshBasicMaterial color="#d775ff" toneMapped={false} />
            </mesh>
          )}
          <mesh
            position={[0, -2, 0]}
            ref={(el) => {
              chargeRefs.current[ship.id] = el;
            }}
            visible={false}
          >
            <sphereGeometry args={[0.55, 12, 10]} />
            <meshBasicMaterial color="#ff6044" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <instancedMesh
        ref={bulletMesh}
        args={[undefined, undefined, MAX_BULLETS]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={blastMesh}
        args={[undefined, undefined, 24]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffb45b" wireframe toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
