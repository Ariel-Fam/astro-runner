"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useGLTF,
  useAnimations,
  Environment,
  ContactShadows,
} from "@react-three/drei";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  Component,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { prepareModel } from "./modelUtils";
import SkyOrbs from "./SkyOrbs";
import Architecture from "./Architecture";
import BuildingSurface from "./BuildingSurface";
import Streets from "./Streets";
import { CITY_GROUND_Y } from "@/data/city";
import Combat, {
  ShootingPose,
  createCombatState,
  type CombatState,
} from "./Combat";
import { resolvePlatform } from "@/data/physics";
import { animationMap6Model } from "@/data/animationMap";
import {
  createPlatforms,
  createObstacles,
  platformX,
  type MapConfig,
  type Platform,
} from "@/data/maps";
import { gameAudio } from "./audio";
import { AMETHYST_DURATION } from "@/data/combat";
export type Telemetry = {
  gameOver: boolean;
  shieldRemaining: number;
  score: number;
  speed: number;
  height: number;
  checkpoint: number;
  collected: number;
  total: number;
  completed: boolean;
  time: number;
  health: number;
  aiming: boolean;
  kills: number;
  threats: number;
  shielded: boolean;
  damaged: boolean;
  respawns: number;
  combatReady: boolean;
};
export type WorldProps = {
  map: MapConfig;
  playing: boolean;
  paused: boolean;
  reset: number;
  sensitivity: number;
  onTelemetry: (data: Telemetry) => void;
  onPause: () => void;
};
type Motion = keyof typeof animationMap6Model;
function Box({
  position,
  size,
  color,
  emissive,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: boolean;
}) {
  return (
    <mesh
      position={position}
      castShadow
      receiveShadow
      userData={{ combatSolid: true }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.78}
        metalness={0.16}
        emissive={emissive ? color : "#000000"}
        emissiveIntensity={emissive ? 1.4 : 0}
      />
    </mesh>
  );
}
function CheckpointLabel({ final }: { final: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#15251a";
    ctx.fillRect(0, 0, 768, 256);
    ctx.strokeStyle = "#d4f86a";
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, 762, 250);
    ctx.fillStyle = "#e7ffbc";
    ctx.textAlign = "center";
    ctx.font = "bold 62px sans-serif";
    ctx.fillText("CHECKPOINT", 384, 85);
    ctx.font = "24px sans-serif";
    ctx.fillText(final ? "ARK 11 · SAFE HARBOR" : "SAFE HARBOR", 384, 132);
    ctx.font = "bold 76px sans-serif";
    ctx.fillText("↓", 384, 225);
    return new THREE.CanvasTexture(canvas);
  }, [final]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite raycast={() => {}} position={[0, 7, 0]} scale={[15, 5, 1]}>
      <spriteMaterial map={texture} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
function Asset({ path, size }: { path: string; size: number }) {
  const { scene } = useGLTF(path);
  const { model, bounds } = useMemo(() => prepareModel(scene), [scene]);
  const scale =
    size / Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 0.001);
  return (
    <group scale={scale}>
      <primitive
        object={model}
        position={bounds.getCenter(new THREE.Vector3()).multiplyScalar(-1)}
      />
    </group>
  );
}
function Amethyst({
  p,
  index,
  combatRef,
  timeRef,
}: {
  p: Platform;
  index: number;
  combatRef: React.RefObject<CombatState>;
  timeRef: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = !combatRef.current.crystals.has(index);
    ref.current.rotation.y = timeRef.current * 0.6;
  });
  return (
    <group ref={ref} position={[p.x, p.y + 3, p.z]}>
      <Suspense fallback={null}>
        <Asset path="/models/gameplay/AmethystCluster.glb" size={2.1} />
      </Suspense>
      <mesh>
        <sphereGeometry args={[1.35, 16, 12]} />
        <meshBasicMaterial
          color="#bd8aff"
          transparent
          opacity={0.12}
          wireframe
        />
      </mesh>
    </group>
  );
}
function Deck({
  finalCheckpoint,
  p,
  map,
  timeRef,
}: {
  p: Platform;
  finalCheckpoint: boolean;
  map: MapConfig;
  timeRef: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.x = platformX(p, timeRef.current);
  });
  return (
    <group ref={ref} position={[p.x, p.y, p.z]}>
      <Suspense
        fallback={
          <Box
            position={[0, -p.h / 2, 0]}
            size={[p.w, p.h, p.d]}
            color={map.concrete}
          />
        }
      >
        <BuildingSurface
          position={[0, -p.h / 2, 0]}
          size={[p.w, p.h, p.d]}
          mapId={map.id}
        />
      </Suspense>
      <Box
        position={[0, -0.12, p.d / 2 + 0.02]}
        size={[p.w, 0.18, 0.06]}
        color={map.color}
        emissive
      />
      <Box
        position={[-p.w / 2 + 0.1, 0.025, 0]}
        size={[0.15, 0.05, p.d]}
        color="#424b40"
      />
      <Box
        position={[p.w / 2 - 0.1, 0.025, 0]}
        size={[0.15, 0.05, p.d]}
        color="#424b40"
      />
      {p.kind === "pad" && (
        <Box
          position={[0, 0.04, 0]}
          size={[3, 0.08, 3]}
          color={map.color}
          emissive
        />
      )}
      {p.kind !== "beam" && (
        <>
          <Suspense
            fallback={
              <Box
                position={[0, -p.h - 9, 0]}
                size={[p.w * 0.38, 18, p.d * 0.5]}
                color="#687261"
              />
            }
          >
            <BuildingSurface
              position={[0, -p.h - 9, 0]}
              size={[p.w * 0.38, 18, p.d * 0.5]}
              mapId={map.id}
              platform={false}
            />
          </Suspense>
          {[-1, 1].map((s) => (
            <Box
              key={s}
              position={[s * (p.w / 2 - 0.7), -p.h / 2, p.d / 2 + 0.06]}
              size={[0.3, p.h * 0.6, 0.13]}
              color="#4c5649"
            />
          ))}
        </>
      )}
      {p.checkpoint && (
        <group position={[0, 0.05, -p.d / 2 + 1]}>
          <group position={[0, 9, -9]}>
            {finalCheckpoint && (
              <Suspense fallback={null}>
                <Asset path="/models/gameplay/ark11.glb" size={17} />
              </Suspense>
            )}
            <CheckpointLabel final={finalCheckpoint} />
          </group>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.25, 48]} />
            <meshBasicMaterial color={map.color} />
          </mesh>
          <Box
            position={[p.w / 2 - 1, 1.2, 0]}
            size={[0.14, 2.4, 0.14]}
            color={map.color}
            emissive
          />
        </group>
      )}
    </group>
  );
}
function City({ map }: { map: MapConfig }) {
  return (
    <group>
      <Suspense fallback={null}>
        <Architecture map={map} />
        <Streets />
      </Suspense>
      {map.id === "08" &&
        [0, 1, 2].map((i) => (
          <group key={`crane-${i}`} position={[-30 + i * 27, 0, -35 - i * 52]}>
            <Box position={[0, 6, 0]} size={[2, 54, 2]} color="#5d6b67" />
            <Box
              position={[12, 32, 0]}
              size={[34, 1.5, 2.5]}
              color={map.color}
            />
            <Box
              position={[22, 22, 0]}
              size={[0.12, 19, 0.12]}
              color="#374640"
            />
            <Box position={[22, 12, 0]} size={[4, 1, 4]} color="#51615b" />
            {[0, 1, 2, 3].map((n) => (
              <Box
                key={n}
                position={[0, n * 10 - 8, 0]}
                size={[3, 0.5, 3]}
                color={map.color}
              />
            ))}
          </group>
        ))}
      <mesh
        position={[0, CITY_GROUND_Y - 0.15, -270]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#424844" roughness={1} />
      </mesh>
      {/* Architectural rings create a recognizable landmark in every district. */}
      <group
        position={[map.id === "07" ? 0 : -35, 15, -110]}
        rotation={[0, 0.3, Math.PI / 2]}
      >
        <mesh>
          <torusGeometry args={[26, 1.5, 8, 80]} />
          <meshStandardMaterial
            color="#c7ccb8"
            metalness={0.55}
            roughness={0.4}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[23.8, 0.15, 6, 80]} />
          <meshBasicMaterial color={map.color} />
        </mesh>
      </group>
    </group>
  );
}
function Collectible({
  p,
  index,
  color,
  collected,
  timeRef,
}: {
  p: Platform;
  index: number;
  color: string;
  collected: React.RefObject<Set<number>>;
  timeRef: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.visible = !collected.current.has(index);
      ref.current.rotation.y = clock.elapsedTime;
      ref.current.position.set(
        platformX(p, timeRef.current),
        p.y + 1.3 + Math.sin(clock.elapsedTime * 2 + p.z) * 0.18,
        p.z,
      );
    }
  });
  return (
    <mesh ref={ref} position={[p.x, p.y + 1.3, p.z]}>
      <octahedronGeometry args={[0.43]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        metalness={0.6}
        roughness={0.2}
      />
    </mesh>
  );
}
function Character({
  motion,
  avatar,
  actionEpoch,
  paused,
  combatRef,
}: {
  combatRef: React.RefObject<CombatState>;
  motion: React.RefObject<Motion>;
  avatar: React.RefObject<THREE.Group | null>;
  actionEpoch: React.RefObject<number>;
  paused: boolean;
}) {
  const { scene, animations } = useGLTF("/models/6animations.glb");
  const model = useMemo(() => prepareModel(scene).model, [scene]);
  const regularRef = useRef<THREE.Group>(null);
  const normalized = useMemo(() => {
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = o as THREE.SkinnedMesh;
        mesh.skeleton.update();
        mesh.computeBoundingBox();
      }
    });
    const b = new THREE.Box3().setFromObject(model);
    const s = THREE.MathUtils.clamp(
      1.85 / Math.max(b.max.y - b.min.y, 0.01),
      0.1,
      2,
    );
    return { scale: s, y: -b.min.y * s };
  }, [model]);
  const { actions, mixer } = useAnimations(animations, model);
  const previous = useRef<THREE.AnimationAction | null>(null);
  const lastEpoch = useRef(-1);
  const finishedEpoch = useRef(-1);
  useEffect(() => {
    const finished = (event: { action: THREE.AnimationAction }) => {
      if (event.action === previous.current)
        finishedEpoch.current = lastEpoch.current;
    };
    mixer.addEventListener("finished", finished);
    return () => mixer.removeEventListener("finished", finished);
  }, [mixer]);
  // Three.js animation actions are mutable playback controls owned by the mixer.
  /* eslint-disable react-hooks/immutability -- Three.js mixers and actions are intentionally mutable playback objects. */
  useFrame(() => {
    if (regularRef.current)
      regularRef.current.visible =
        !combatRef.current.aiming ||
        !combatRef.current.grounded ||
        !combatRef.current.poseReady;
    mixer.timeScale =
      paused || (combatRef.current.aiming && combatRef.current.grounded)
        ? 0
        : 1;
    const requested = motion.current;
    const current =
      (requested === "jump" || requested === "backflip") &&
      finishedEpoch.current === actionEpoch.current
        ? "falling"
        : requested;
    const a = actions[animationMap6Model[current]];
    if (
      a &&
      (previous.current !== a || lastEpoch.current !== actionEpoch.current)
    ) {
      const one = current === "jump" || current === "backflip";
      a.reset().setLoop(
        one ? THREE.LoopOnce : THREE.LoopRepeat,
        one ? 1 : Infinity,
      );
      a.clampWhenFinished = one;
      a.enabled = true;
      a.setEffectiveTimeScale(
        current === "backflip"
          ? 3.6
          : current === "jump"
            ? 3.2
            : motion.current === "running"
              ? 1.1
              : 1,
      );
      a.setEffectiveWeight(1);
      a.play();
      if (previous.current && previous.current !== a)
        a.crossFadeFrom(previous.current, 0.18, false);
      else a.fadeIn(0.12);
      previous.current = a;
      lastEpoch.current = actionEpoch.current;
    }
  });
  /* eslint-enable react-hooks/immutability */
  return (
    <group ref={avatar}>
      <group
        ref={regularRef}
        scale={normalized.scale}
        position={[0, normalized.y, 0]}
      >
        <primitive object={model} />
      </group>
      <ShieldAura combatRef={combatRef} />
      <Suspense fallback={null}>
        <ShootingPose combatRef={combatRef} />
      </Suspense>
    </group>
  );
}
function ShieldAura({
  combatRef,
}: {
  combatRef: React.RefObject<CombatState>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.visible =
        combatRef.current.amethystUntil > combatRef.current.time;
      ref.current.rotation.y += 0.008;
    }
  });
  return (
    <mesh
      ref={ref}
      visible={false}
      position={[0, 1, 0]}
      scale={[0.85, 1.15, 0.85]}
    >
      <icosahedronGeometry args={[1.2, 1]} />
      <meshBasicMaterial
        color="#c08aff"
        transparent
        opacity={0.2}
        wireframe
        depthWrite={false}
      />
    </mesh>
  );
}
function Controller({
  config,
  platforms,
  obstacles,
  collected,
  timeRef,
  combatRef,
}: {
  combatRef: React.RefObject<CombatState>;
  config: WorldProps;
  platforms: Platform[];
  obstacles: Platform[];
  collected: React.RefObject<Set<number>>;
  timeRef: React.RefObject<number>;
}) {
  const { camera, gl } = useThree();
  const avatar = useRef<THREE.Group>(null);
  const motion = useRef<Motion>("idle");
  const actionEpoch = useRef(0);
  const state = useRef({
    p: new THREE.Vector3(0, 0, 10),
    v: new THREE.Vector3(),
    yaw: 0,
    pitch: 0.3,
    distance: 7,
    keys: new Set<string>(),
    jump: 0,
    flip: 0,
    ground: true,
    coyote: 0,
    jumps: 0,
    checkpoint: 0,
    spawn: new THREE.Vector3(0, 0, 10),
    elapsed: 0,
    lastReport: 0,
    completed: false,
    gameOver: false,
    airAction: false,
    drag: false,
  });
  const look = useRef(new THREE.Vector3(0, 1, 10));
  const rayRef = useRef(new THREE.Raycaster());
  const cameraSolids = useRef<THREE.Object3D[]>([]);
  useEffect(() => {
    const s = state.current,
      canvas = gl.domElement;
    const combat = combatRef.current;
    const down = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("button, input, summary, a, textarea")
      )
        return;
      if (!config.playing || config.paused || s.gameOver || s.completed) return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      s.keys.add(e.code);
      if (!e.repeat && e.code === "Space" && !combat.aiming) s.jump = 0.15;
      if (!e.repeat && e.code === "KeyB" && s.ground && !combat.aiming) {
        s.flip = 0.95;
        s.jump = 0.15;
      }
      const c = combatRef.current;
      if (!e.repeat && e.code === "KeyE") {
        c.aiming = true;
        s.jump = 0;
        s.v.x = 0;
        s.v.z = 0;
      }
      if (e.code === "KeyF" && c.aiming) {
        c.firing = true;
        c.fireQueued = true;
      }
      if (!e.repeat && e.code === "KeyR") {
        if (c.aiming) {
          c.aiming = false;
          c.firing = false;
          c.fireQueued = false;
        } else {
          s.p.copy(s.spawn);
          s.v.set(0, 0, 0);
          s.jumps = 0;
          s.flip = 0;
          c.health = 100;
          c.shieldUntil = Math.max(c.shieldUntil, s.elapsed + 4);
          c.clear++;
        }
      }
      if (e.code === "Escape") config.onPause();
    };
    const up = (e: KeyboardEvent) => {
      s.keys.delete(e.code);
      if (e.code === "KeyF") combatRef.current.firing = false;
    };
    const blur = () => {
      s.keys.clear();
      combatRef.current.firing = false;
      if (config.playing && !config.paused) config.onPause();
    };
    const mouse = (e: MouseEvent) => {
      if (!config.playing || config.paused || s.gameOver || s.completed) return;
      if (document.pointerLockElement !== canvas && !s.drag) return;
      s.yaw -= e.movementX * 0.003 * config.sensitivity;
      s.pitch = THREE.MathUtils.clamp(
        s.pitch + e.movementY * 0.0024 * config.sensitivity,
        combatRef.current.aiming ? -0.95 : -0.2,
        0.85,
      );
    };
    const lock = () => {
      if (config.playing && !config.paused) {
        try {
          const p = canvas.requestPointerLock();
          if (p) p.catch(() => {});
        } catch {}
      }
    };
    const drag = (event: PointerEvent) => {
      s.drag = true;
      if (
        event.button === 0 &&
        config.playing &&
        !config.paused &&
        document.pointerLockElement === canvas &&
        combatRef.current.aiming
      ) {
        combatRef.current.firing = true;
        combatRef.current.fireQueued = true;
      }
    };
    const release = () => {
      s.drag = false;
      combatRef.current.firing = false;
    };
    const wheel = (e: WheelEvent) => {
      if (config.playing)
        s.distance = THREE.MathUtils.clamp(
          s.distance + e.deltaY * 0.005,
          3,
          12,
        );
    };
    const lockChange = () => {
      if (!document.pointerLockElement) {
        s.keys.clear();
        if (config.playing && !config.paused) config.onPause();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("mousemove", mouse);
    canvas.addEventListener("click", lock);
    canvas.addEventListener("pointerdown", drag);
    window.addEventListener("pointerup", release);
    canvas.addEventListener("wheel", wheel);
    document.addEventListener("pointerlockchange", lockChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("mousemove", mouse);
      canvas.removeEventListener("click", lock);
      canvas.removeEventListener("pointerdown", drag);
      window.removeEventListener("pointerup", release);
      canvas.removeEventListener("wheel", wheel);
      document.removeEventListener("pointerlockchange", lockChange);
      s.keys.clear();
      combat.firing = false;
      combat.fireQueued = false;
    };
    // The listener reads only these configuration fields. Telemetry updates do not change bindings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.playing, config.paused, config.sensitivity, config.onPause, gl]);
  useFrame(({ clock, scene }, dt) => {
    const s = state.current;
    const c = combatRef.current;
    const delta = Math.min(dt, 0.035);
    if (!config.playing) {
      const t = clock.elapsedTime * 0.025;
      camera.position.set(40 + Math.sin(t) * 6, 30, 48);
      camera.lookAt(0, 15, -85);
      motion.current = "idle";
      return;
    }
    if (config.paused || s.completed || s.gameOver) {
      motion.current = "idle";
      return;
    }
    const die = () => {
      s.gameOver = true;
      c.dead = true;
      c.health = 0;
      c.firing = false;
      s.keys.clear();
      gameAudio.setActive(false);
      document.exitPointerLock?.();
    };
    if (c.health <= 0) die();
    s.elapsed += delta;
    timeRef.current = s.elapsed;
    c.time = s.elapsed;
    s.flip = Math.max(0, s.flip - delta);
    s.jump = Math.max(0, s.jump - delta);
    s.coyote = s.ground ? 0.11 : Math.max(0, s.coyote - delta);
    const k = s.keys;
    const dir = new THREE.Vector3(
      Number(k.has("KeyD") || k.has("ArrowRight")) -
        Number(k.has("KeyA") || k.has("ArrowLeft")),
      0,
      Number(k.has("KeyS") || k.has("ArrowDown")) -
        Number(k.has("KeyW") || k.has("ArrowUp")),
    )
      .normalize()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
    if (c.aiming) dir.set(0, 0, 0);
    const sprint = !c.aiming && (k.has("ShiftLeft") || k.has("ShiftRight"));
    const speed = sprint ? 10.5 : 6;
    const smooth = 1 - Math.exp(-delta * (s.ground ? 14 : 5));
    s.v.x = c.aiming ? 0 : THREE.MathUtils.lerp(s.v.x, dir.x * speed, smooth);
    s.v.z = c.aiming ? 0 : THREE.MathUtils.lerp(s.v.z, dir.z * speed, smooth);
    const wasGrounded = s.ground;
    if (!c.aiming && s.jump > 0 && (s.coyote > 0 || s.jumps < 2)) {
      gameAudio.shot("jump", 0.65);
      s.v.y = config.map.id === "06" ? 9 : 9.8;
      s.ground = false;
      s.coyote = 0;
      s.jumps++;
      s.jump = 0;
      actionEpoch.current++;
      s.airAction = true;
    }
    const old = s.p.clone();
    s.v.y -= (config.map.id === "06" ? 13 : 23) * delta;
    s.p.addScaledVector(s.v, delta);
    s.ground = false;
    let landed = false;
    for (const p of [...platforms, ...obstacles]) {
      const x = platformX(p, timeRef.current);
      if (resolvePlatform(s.p, old, s.v, p, x)) {
        if (!wasGrounded) landed = true;
        s.ground = true;
        s.airAction = false;
        s.flip = 0;
        s.jumps = 0;
        if (p.kind === "moving")
          s.p.x += Math.cos(timeRef.current * 0.7 + p.z) * 2.1 * delta;
        if (p.kind === "pad") {
          gameAudio.shot("jump", 0.65);
          s.v.y = 14;
          s.ground = false;
          s.jumps = 1;
          actionEpoch.current++;
          s.airAction = true;
        }
        if (p.checkpoint) {
          const idx = platforms.filter((q) => q.checkpoint).indexOf(p);
          if (idx > s.checkpoint) {
            s.checkpoint = idx;
            s.spawn.set(p.x, p.y, p.z);
            c.health = 100;
            c.shieldUntil = Math.max(c.shieldUntil, s.elapsed + 4);
            c.clear++;
          }
        }
      }
    }
    if (landed) gameAudio.shot("landing", 0.75);
    if (config.map.id === "05") {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (
          p.kind === "deck" &&
          !p.checkpoint &&
          i % 5 === 0 &&
          Math.abs(s.p.z - p.z) < 0.25 &&
          Math.abs(s.p.x - p.x) < p.w / 2 &&
          s.p.y < p.y + 0.8 &&
          s.p.y >= p.y - 0.1
        ) {
          die();
        }
      }
    }
    if (s.p.y < -25) {
      die();
    }
    platforms.forEach((p, i) => {
      if (
        i > 0 &&
        i % 3 === 0 &&
        s.p.distanceTo(
          new THREE.Vector3(platformX(p, timeRef.current), p.y + 1.3, p.z),
        ) < 1.8
      )
        collected.current.add(i);
    });
    platforms.forEach((p, i) => {
      if (
        p.amethyst &&
        !c.crystals.has(i) &&
        s.p
          .clone()
          .add(new THREE.Vector3(0, 1, 0))
          .distanceTo(new THREE.Vector3(p.x, p.y + 3, p.z)) < 1.65
      ) {
        c.crystals.add(i);
        c.amethystUntil = s.elapsed + AMETHYST_DURATION;
        c.shieldUntil = Math.max(c.shieldUntil, c.amethystUntil);
      }
    });
    const goal = platforms.filter((p) => p.d === 8).at(-1)!;
    if (
      !s.gameOver &&
      s.p.distanceTo(new THREE.Vector3(goal.x, goal.y, goal.z)) < 3
    ) {
      s.completed = true;
      c.firing = false;
      c.fireQueued = false;
      document.exitPointerLock?.();
    }
    motion.current = !s.ground
      ? s.airAction
        ? s.flip > 0
          ? "backflip"
          : "jump"
        : "falling"
      : dir.lengthSq() > 0
        ? sprint
          ? "running"
          : "walking"
        : "idle";
    if (avatar.current) {
      avatar.current.position.copy(s.p);
      if (c.aiming || dir.lengthSq() > 0.01) {
        const target = c.aiming ? s.yaw + Math.PI : Math.atan2(dir.x, dir.z);
        avatar.current.rotation.y +=
          Math.atan2(
            Math.sin(target - avatar.current.rotation.y),
            Math.cos(target - avatar.current.rotation.y),
          ) *
          (1 - Math.exp(-delta * 14));
      }
    }
    c.grounded = s.ground;
    gameAudio.loop(
      "falling",
      !s.ground && s.v.y < -0.5 && !s.gameOver ? 0.35 : 0,
    );
    gameAudio.loop(
      "footsteps",
      s.ground && dir.lengthSq() > 0 && !s.gameOver ? 0.6 : 0,
      sprint ? 1.4 : 1,
    );
    c.position.copy(s.p);
    c.velocity.copy(s.v);
    c.yaw = s.yaw;
    const focus = s.p.clone().add(new THREE.Vector3(0, 1.35, 0));
    if (c.aiming)
      focus.add(
        new THREE.Vector3(0.6, 0, 0).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          s.yaw,
        ),
      );
    const offset = new THREE.Vector3(
      Math.sin(s.yaw) * Math.cos(s.pitch),
      Math.sin(s.pitch) + 0.08,
      Math.cos(s.yaw) * Math.cos(s.pitch),
    ).multiplyScalar(c.aiming ? 4.4 : s.distance);
    // Shorten the camera boom when architecture lies between camera and player.
    const ray = rayRef.current;
    ray.set(focus, offset.clone().normalize());
    ray.far = offset.length();
    if (!cameraSolids.current.length)
      scene.traverse((object) => {
        if (object.userData.cameraSolid) cameraSolids.current.push(object);
      });
    const hits = ray
      .intersectObjects(cameraSolids.current, false)
      .filter((h) => h.distance > 0.8);
    if (hits[0]) offset.setLength(Math.max(1, hits[0].distance - 0.35));
    camera.position.lerp(focus.clone().add(offset), 1 - Math.exp(-delta * 12));
    look.current.lerp(focus, 1 - Math.exp(-delta * 16));
    camera.lookAt(look.current);
    if (s.elapsed - s.lastReport > 0.1 || s.completed || s.gameOver) {
      s.lastReport = s.elapsed;
      config.onTelemetry({
        gameOver: s.gameOver,
        score: collected.current.size * 100,
        shieldRemaining: Math.max(0, c.amethystUntil - s.elapsed),
        speed: Math.hypot(s.v.x, s.v.z),
        height: s.p.y + 148,
        checkpoint: s.checkpoint,
        collected: collected.current.size,
        total: platforms.filter((_, i) => i > 0 && i % 3 === 0).length,
        completed: s.completed,
        time: s.elapsed,
        health: c.health,
        aiming: c.aiming,
        kills: c.kills,
        threats: c.threats,
        shielded: s.elapsed < c.shieldUntil,
        damaged: s.elapsed < c.hitUntil,
        respawns: c.respawns,
        combatReady: c.ready,
      });
    }
  });
  return (
    <Suspense
      fallback={
        <mesh position={[0, 1, 10]}>
          <capsuleGeometry args={[0.3, 1]} />
          <meshStandardMaterial color={config.map.color} />
        </mesh>
      }
    >
      <Character
        combatRef={combatRef}
        motion={motion}
        avatar={avatar}
        actionEpoch={actionEpoch}
        paused={config.paused || !config.playing}
      />
    </Suspense>
  );
}
function Scene({ config }: { config: WorldProps }) {
  const platforms = useMemo(() => createPlatforms(config.map), [config.map]);
  const obstacles = useMemo(
    () => createObstacles(config.map, platforms),
    [config.map, platforms],
  );
  const finalCheckpoint = platforms.filter((p) => p.checkpoint).at(-1);
  const night = ["02", "05", "06"].includes(config.map.id);
  const collected = useRef(new Set<number>());
  const timeRef = useRef(0);
  const combatRef = useRef(createCombatState());
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    group.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.userData.cameraSolid = true;
    });
  }, []);
  return (
    <>
      <color attach="background" args={[config.map.sky]} />
      <fog attach="fog" args={[config.map.sky, 100, 420]} />
      <ambientLight intensity={night ? 0.3 : 0.65} />
      <hemisphereLight
        args={[night ? "#9eafff" : "#f5f2d9", "#65735d", night ? 0.6 : 1.2]}
      />
      <directionalLight
        position={[50, 80, 30]}
        intensity={night ? 1.3 : 2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-camera-bottom={-65}
        shadow-normalBias={0.05}
      />
      <Suspense fallback={null}>
        <Environment
          files="/hdri/nubula.hdr"
          background
          backgroundIntensity={1}
          environmentIntensity={0.9}
        />
      </Suspense>
      <City map={config.map} />
      <Suspense fallback={null}>
        <SkyOrbs map={config.map} timeRef={timeRef} />
      </Suspense>
      <group ref={group}>
        {platforms.map((p, i) => (
          <Deck
            key={i}
            p={p}
            finalCheckpoint={p === finalCheckpoint}
            map={config.map}
            timeRef={timeRef}
          />
        ))}
        {obstacles.map((p, i) => (
          <group key={`obstacle-${i}`} position={[p.x, p.y - p.h / 2, p.z]}>
            {config.map.id === "02" && p.w < 3 ? (
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[p.h / 2, p.h / 2, p.d, 12]} />
                <meshStandardMaterial
                  color="#39444b"
                  metalness={0.7}
                  roughness={0.35}
                />
              </mesh>
            ) : (
              <Box
                position={[0, 0, 0]}
                size={[p.w, p.h, p.d]}
                color={config.map.id === "03" ? "#304855" : "#4e5c48"}
              />
            )}
            <Box
              position={[0, p.h / 2 + 0.03, 0]}
              size={[p.w, 0.06, 0.15]}
              color={config.map.color}
              emissive
            />
            {config.map.id === "04" && p.w < 3 && (
              <mesh position={[0, p.h / 2 + 0.8, 0]} castShadow>
                <icosahedronGeometry args={[1, 1]} />
                <meshStandardMaterial color="#457955" />
              </mesh>
            )}
          </group>
        ))}
      </group>
      {platforms.map((p, i) =>
        p.amethyst ? (
          <Amethyst
            key={`amethyst-${i}`}
            p={p}
            index={i}
            combatRef={combatRef}
            timeRef={timeRef}
          />
        ) : null,
      )}
      {platforms.map((p, i) =>
        i > 0 && i % 3 === 0 ? (
          <Collectible
            key={i}
            p={p}
            index={i}
            color="#87ceeb"
            collected={collected}
            timeRef={timeRef}
          />
        ) : null,
      )}
      {config.map.id === "05" &&
        platforms.map((p, i) =>
          p.kind === "deck" && !p.checkpoint && i % 5 === 0 ? (
            <Box
              key={i}
              position={[p.x, p.y + 0.55, p.z]}
              size={[p.w, 0.09, 0.09]}
              color="#ff5886"
              emissive
            />
          ) : null,
        )}
      <group
        position={[
          platforms.filter((p) => p.d === 8).at(-1)!.x,
          platforms.filter((p) => p.d === 8).at(-1)!.y + 2,
          platforms.filter((p) => p.d === 8).at(-1)!.z,
        ]}
      >
        <mesh>
          <torusGeometry args={[2, 0.14, 8, 48]} />
          <meshBasicMaterial color={config.map.color} />
        </mesh>
      </group>
      <ContactShadows
        position={[0, 0.015, 8]}
        opacity={0.35}
        scale={25}
        blur={2.5}
        far={5}
      />
      <Controller
        combatRef={combatRef}
        config={config}
        platforms={platforms}
        obstacles={obstacles}
        collected={collected}
        timeRef={timeRef}
      />
      {config.playing && (
        <Combat
          platforms={platforms}
          map={config.map}
          paused={config.paused}
          combatRef={combatRef}
          timeRef={timeRef}
        />
      )}
    </>
  );
}
class CanvasBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="webgl-error">
        <h3>Graphics unavailable</h3>
        <p>
          Enable WebGL and hardware acceleration, then reload to explore New
          Eden.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function World(props: WorldProps) {
  return (
    <CanvasBoundary>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ position: [40, 30, 48], fov: 48, near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Scene key={`${props.map.id}-${props.reset}`} config={props} />
      </Canvas>
    </CanvasBoundary>
  );
}
