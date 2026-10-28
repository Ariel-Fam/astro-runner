"use client";
import "./enhancements.css";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { maps, createPlatforms } from "@/data/maps";
import { Icon, Logo, MapArt } from "./Icons";
import AudioControls from "./AudioControls";
import ControlsGuide from "./ControlsGuide";
import { gameAudio } from "./audio";
import { createFleet, AMETHYST_DURATION } from "@/data/combat";
import type { Telemetry } from "./World";
import Image from "next/image";


const World = dynamic(() => import("./World"), {
  ssr: false,
  loading: () => (
    <div className="world-loading">
      <span />
      ASSEMBLING NEW EDEN
    </div>
  ),
});
const initial: Telemetry = {
  gameOver: false,
  score: 0,
  shieldRemaining: 0,
  speed: 0,
  height: 148,
  checkpoint: 0,
  collected: 0,
  total: createPlatforms(maps[0]).filter((_, i) => i > 0 && i % 3 === 0).length,
  completed: false,
  time: 0,
  health: 100,
  aiming: false,
  kills: 0,
  threats: 0,
  shielded: true,
  damaged: false,
  respawns: 0,
  combatReady: false,
};
const orientation = [
  {
    title: "Move with intention.",
    description:
      "Use WASD or arrow keys to move relative to your camera. Click the world to capture your mouse, or drag to look around. Scroll to adjust camera distance. Press Esc to pause. Open Sound Mix to adjust or mute music and effects separately; your preferences are saved.",
  },
  {
    title: "A little less gravity.",
    description:
      "Hold Shift to sprint. Press Space to jump, then again in the air for a double jump. Press B while on a platform to backflip. Square bounce pads launch you higher. In the air, your suit settles into a falling pose before landing.",
  },
  {
    title: "Hold your ground.",
    description:
      "Press E to equip your weapon and stand still. Movement and jumps are disabled while aiming. Move the mouse to aim after capturing it, or drag to look. Hold left-click to fire after capturing the mouse, or hold F. Press R to lower your weapon and move again. Three hits break a ship’s force field; a fourth destroys it. Use rooftops for cover between volleys.",
  },
  {
    title: "Take the route that rewards you.",
    description:
      "Collect octahedrons for 100 points each. Reach a purple amethyst above a small bounce pad for 22.2 seconds of immunity to ship fire; the purple countdown shows how much remains. These detours cross dangerous gaps. A purple-marked guardian circles nearby amethysts, and three roaming ships fly wider routes across the district. Text and arrows mark checkpoints that restore health; the final checkpoint has the large ARK 11 ship. Press R while unarmed to return to your checkpoint. Falling below the rooftops or losing all health ends the run. Choose Restart to try again, or reach the transit gate to finish.",
  },
];
const formatTime = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
export default function RunnerApp() {
  const [selected, setSelected] = useState(0),
    [playing, setPlaying] = useState(false),
    [paused, setPaused] = useState(false),
    [reset, setReset] = useState(0),
    [modal, setModal] = useState<"guide" | "settings" | null>(null),
    [step, setStep] = useState(0),
    [sensitivity, setSensitivity] = useState(1),
    [data, setData] = useState(initial),
    [records, setRecords] = useState<Record<string, number>>({}),
    [tab, setTab] = useState("explore");
  const root = useRef<HTMLDivElement>(null);
  const map = maps[selected];
  useEffect(() => {
    gameAudio.setActive(
      playing && !paused && !data.completed && !data.gameOver && !modal,
    );
    return () => gameAudio.setActive(false);
  }, [playing, paused, data.completed, data.gameOver, modal]);
  const pause = useCallback(() => setPaused(true), []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".reveal", {
        y: 24,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
      });
      gsap.from(".hero-world", {
        opacity: 0,
        scale: 1.04,
        duration: 1.8,
        ease: "power2.out",
      });
    }, root);
    return () => ctx.revert();
  }, []);
  useEffect(() => {
    if (
      modal &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const ctx = gsap.context(
        () =>
          gsap.from(".modal", {
            y: 24,
            opacity: 0,
            duration: 0.4,
            ease: "power3.out",
          }),
        root,
      );
      return () => ctx.revert();
    }
  }, [modal, step]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem("astro-records");
        if (saved) setRecords(JSON.parse(saved));
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!modal && !paused && !data.completed && !data.gameOver) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = root.current?.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => [
      ...(dialog?.querySelectorAll<HTMLElement>(
        'button, input, [tabindex="0"]',
      ) ?? []),
    ];
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        if (modal) setModal(null);
        else if (!data.completed && !data.gameOver) setPaused(false);
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [modal, paused, data.completed, data.gameOver]);
  const report = useCallback(
    (next: Telemetry) => {
      setData(next);
      if (next.completed) {
        setRecords((prev) => {
          const old = prev[map.id];
          const updated = {
            ...prev,
            [map.id]: old ? Math.min(old, next.time) : next.time,
          };
          try {
            localStorage.setItem("astro-records", JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    },
    [map.id],
  );
  const start = () => {
    gameAudio.unlock();
    setModal(null);
    setData(initial);
    setReset((v) => v + 1);
    setPlaying(true);
    setPaused(false);
  };
  const launch = () => {
    try {
      if (localStorage.getItem("astro-onboarded") === "2") {
        start();
        return;
      }
    } catch {}
    setStep(0);
    setModal("guide");
  };
  const home = () => {
    setPlaying(false);
    setPaused(false);
    setData(initial);
    document.exitPointerLock?.();
  };
  const restart = () => {
    gameAudio.unlock();
    setReset((v) => v + 1);
    setData(initial);
    setPaused(false);
  };
  const showMaps = () => {
    setTab("explore");
    document
      .getElementById("districts")
      ?.scrollIntoView({ behavior: "smooth" });
  };
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.current?.requestFullscreen?.().catch(() => {});
  };
  return (
    <div
      ref={root}
      className={`runner-app ${playing ? "is-playing" : ""}`}
      style={{ width: "100%", "--accent": map.color } as React.CSSProperties}
    >
      {!playing && (
        <header className="topbar reveal">
          <Link className="brand" href="/" aria-label="Astro Runner home">
            <Logo />
            <span>
              ASTRO<span className="brand-light">RUNNER</span>
              <small>DEFY THE ORDINARY.</small>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            <button
              className={tab === "explore" ? "active" : ""}
              onClick={showMaps}
            >
              Explore <span>{String(maps.length).padStart(2, "0")}</span>
            </button>
            <button
              onClick={() => {
                setStep(0);
                setModal("guide");
              }}
            >
              How to play
            </button>
            <button
              className={tab === "records" ? "active" : ""}
              onClick={() => {
                setTab("records");
                document
                  .getElementById("districts")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Personal bests
            </button>
          </nav>
          <div className="top-right">
            <span className="online">
              <i /> SYSTEM ONLINE
            </span>
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={() => setModal("settings")}
            >
              <Icon name="settings" />
            </button>
            <div className="profile">
              AR
              <span />
            </div>
          </div>
        </header>
      )}
      <AudioControls />
      <main>
        <section className={`hero ${playing ? "game-hero" : ""}`}>
          <div className="hero-world">
            <World
              map={map}
              playing={playing}
              paused={paused || data.completed || data.gameOver || !!modal}
              reset={reset}
              sensitivity={sensitivity}
              onTelemetry={report}
              onPause={pause}
            />
          </div>
          {!playing ? (
            <>
              <div className="hero-shade" />
              <div className="hero-grain" />
              <div className="hero-copy">
                <div className="eyebrow reveal">
                  <span className="little-cross">+</span> NO LIMITS. JUST
                  MOMENTUM.
                </div>
                <h1 className="reveal">
                  THE CITY IS
                  <br />
                  YOUR
                  <br />
                  <span>PLAYGROUND.</span>
                </h1>

                <Image src="/softwareLogo.png" 
                alt="alt" 
                width={200} 
                height={100}  
                className="mb-8 mt-4"
                />

                <p className="hero-description reveal">
                  Above the noise. Beyond the ordinary.
                  <br />
                  Find your own way through the world of tomorrow.
                </p>
                <div className="hero-actions mb-10 reveal">
                  <button className="primary" onClick={launch}>
                    ENTER THE CITY <Icon name="arrow" size={22} />
                  </button>
                  <button
                    className="watch-button"
                    onClick={() => {
                      setStep(0);
                      setModal("guide");
                    }}
                  >
                    <span>
                      <Icon name="play" size={15} />
                    </span>
                    LEARN THE MOVES
                  </button>
                </div>
                <div className="hero-facts reveal">
                  <div>
                    <strong>{String(maps.length).padStart(2, "0")}</strong>
                    <span>UNIQUE DISTRICTS</span>
                  </div>
                  <div>
                    <strong>∞</strong>
                    <span>WAYS TO EXPLORE</span>
                  </div>
                  <div>
                    <Icon name="compass" size={25} />
                    <span>YOUR OWN PACE</span>
                  </div>
                </div>
              </div>
              <div className="scene-label reveal">
                <span className="live-tag">
                  <i /> LIVE WORLD PREVIEW
                </span>
                <div>
                  <span className="location-mark">
                    <Icon name="globe" size={18} />
                  </span>
                  <div>
                    <strong>{map.name}</strong>
                    <small>{map.district}</small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Fullscreen preview"
                    onClick={fullscreen}
                  >
                    <Icon name="expand" size={17} />
                  </button>
                </div>
              </div>
              <div className="hero-coordinate">
                35° 41′ N &nbsp; 139° 41′ E <span>EST. 2186</span>
              </div>
              <div className="vertical-label">A NEW PERSPECTIVE AWAITS</div>
            </>
          ) : (
            <>
              <div className="game-top">
                <button
                  className="brand compact"
                  onClick={home}
                  aria-label="Return home"
                >
                  <Logo />
                  <span>
                    ASTRO<span className="brand-light">RUNNER</span>
                  </span>
                </button>
                <div className="game-location">
                  <span className="eyebrow">{map.district}</span>
                  <strong>{map.name}</strong>
                </div>
                <button
                  className="hud-button"
                  onClick={() => {
                    setPaused(true);
                    document.exitPointerLock?.();
                  }}
                >
                  <Icon name="pause" /> PAUSE <kbd>ESC</kbd>
                </button>
              </div>
              <div className="game-objective">
                <Icon name="flag" />
                <div>
                  <small>FIND YOUR WAY</small>
                  <strong>Reach the transit gate</strong>
                  <span>
                    Follow the illuminated decks · {data.collected}/{data.total}{" "}
                    signals · {data.score.toLocaleString()} PTS
                  </span>
                </div>
              </div>
              <div className={`crosshair ${data.aiming ? "aiming" : ""}`} />
              <div className="combat-panel" aria-live="polite">
                <div className="combat-status">
                  <span className={data.shielded ? "shield-active" : ""}>
                    {data.shielded ? "SHIELD ACTIVE" : "SUIT INTEGRITY"}
                  </span>
                  <strong>{data.health}%</strong>
                </div>
                <div className="health-track">
                  <i
                    style={{
                      width: `${data.health}%`,
                      background: data.health <= 36 ? "#ff705a" : undefined,
                    }}
                  />
                </div>
                <div className="combat-counts">
                  <span>
                    {data.combatReady
                      ? `${data.threats} ACTIVE THREATS`
                      : "PATROLS INBOUND"}
                  </span>
                  <span>
                    {data.kills} / {createFleet(map.seed, map.height).length}{" "}
                    DOWN
                  </span>
                </div>
                {data.shieldRemaining > 0 && (
                  <div
                    className="amethyst-timer"
                    role="timer"
                    aria-label="Amethyst shield time remaining"
                  >
                    <div>
                      <span>AMETHYST SHIELD</span>
                      <strong>{data.shieldRemaining.toFixed(1)}s</strong>
                    </div>
                    <div className="health-track">
                      <i
                        style={{
                          width: `${(100 * data.shieldRemaining) / AMETHYST_DURATION}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="weapon-status">
                  {data.aiming
                    ? "HOLD POSITION · LMB / F TO FIRE"
                    : "EQUIP DEFENSE · PRESS E"}
                </div>
              </div>
              {data.damaged && <div className="damage-flash" />}
              {data.aiming && (
                <div className="aim-label">
                  DEFENSE MODE <span>R TO LOWER WEAPON</span>
                </div>
              )}
              <div className="game-bottom">
                <div className="speed">
                  <strong>
                    {Math.round(data.speed * 3.6)
                      .toString()
                      .padStart(2, "0")}
                  </strong>
                  <span>KM/H</span>
                  <div>
                    <i style={{ width: `${Math.min(100, data.speed * 9)}%` }} />
                  </div>
                </div>
                <div className="hud-stats">
                  <span>
                    <small>RUN TIME</small>
                    {formatTime(data.time)}
                  </span>
                  <span>
                    <small>ALTITUDE</small>
                    {Math.round(data.height)} M
                  </span>
                  <span>
                    <small>CHECKPOINT</small>
                    {data.checkpoint} /{" "}
                    {createPlatforms(map).filter((p) => p.checkpoint).length -
                      1}
                  </span>
                </div>
                <div className="game-help">
                  <span>
                    <kbd>W A S D</kbd> MOVE
                  </span>
                  <span>
                    <kbd>SPACE</kbd> DOUBLE JUMP
                  </span>
                  <span>
                    <kbd>SHIFT</kbd> SPRINT
                  </span>
                  <span>
                    <kbd>B</kbd> BACKFLIP
                  </span>
                  <span>
                    <kbd>E</kbd> AIM &nbsp; <kbd>LMB / F</kbd> FIRE
                  </span>
                  <span>
                    <kbd>R</kbd> {data.aiming ? "LOWER WEAPON" : "RESPAWN"}
                  </span>
                </div>
              </div>
              <div className="mouse-hint">
                CLICK TO CAPTURE MOUSE · DRAG TO LOOK · SCROLL TO ZOOM
              </div>
              {(paused || data.completed || data.gameOver) && (
                <div className="overlay game-overlay">
                  <div
                    className="modal pause-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={
                      data.gameOver
                        ? "Game over"
                        : data.completed
                          ? "District complete"
                          : "Game paused"
                    }
                  >
                    <span className="eyebrow">
                      {data.gameOver
                        ? "RUN ENDED"
                        : data.completed
                          ? "DISTRICT EXPLORED"
                          : "TAKE A BREATHER"}
                    </span>
                    <h2>
                      {data.gameOver
                        ? "Game over."
                        : data.completed
                          ? "A new perspective."
                          : "Catch your breath."}
                    </h2>
                    <p>
                      {data.gameOver
                        ? `Your suit lost integrity or you fell beyond the rooftops. ${data.score.toLocaleString()} points · ${data.collected} signals · ${data.kills} ships. Try a new route.`
                        : data.completed
                          ? `You crossed ${map.name} in ${formatTime(data.time)} and discovered ${data.collected} signals. ${data.kills} patrol ships neutralized.`
                          : "Your next leap is right where you left it."}
                    </p>
                    {data.completed ? (
                      <button
                        className="primary"
                        onClick={() => {
                          setSelected((selected + 1) % maps.length);
                          restart();
                        }}
                      >
                        NEXT DISTRICT <Icon name="arrow" />
                      </button>
                    ) : !data.gameOver ? (
                      <button
                        className="primary"
                        onClick={() => {
                          gameAudio.unlock();
                          setPaused(false);
                        }}
                      >
                        KEEP EXPLORING <Icon name="arrow" />
                      </button>
                    ) : null}
                    <button className="secondary" onClick={restart}>
                      <Icon name="reset" /> Restart district
                    </button>
                    <button className="text-button" onClick={home}>
                      Return to base
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        {!playing && (
          <>
             
            <section id="districts" className="districts">
              <div className="section-heading reveal">
                <div>
                  <div className="eyebrow">THE WORLD IS YOURS</div>
                  <h2>
                    {tab === "records"
                      ? "Leave your mark."
                      : "Choose your horizon."}
                  </h2>
                </div>
                <p>
                  {tab === "records"
                    ? "Your fastest routes through New Eden."
                    : "Eight districts. Eight different perspectives."}
                  <br />
                  {tab === "records"
                    ? "Explore a district to set your first time."
                    : "One city waiting to be explored."}
                </p>
                <span className="section-count">
                  01 — {String(maps.length).padStart(2, "0")}{" "}
                  <Icon name="globe" size={20} />
                </span>
              </div>
              <div
                className="map-grid"
                style={{
                  gridTemplateColumns: `repeat(${maps.length}, minmax(0, 1fr))`,
                }}
              >
                {maps.map((m, i) => (
                  <button
                    key={m.id}
                    className={`map-card ${selected === i ? "selected" : ""}`}
                    style={{ "--map-color": m.color } as React.CSSProperties}
                    onClick={() => {
                      setSelected(i);
                      if (tab === "records") {
                        setTab("explore");
                      }
                    }}
                    aria-pressed={selected === i}
                  >
                    <div className="map-visual">
                      <span className="map-number">{m.id} /</span>
                      <MapArt seed={m.seed} color={m.color} />
                      <span className="map-select-icon">
                        <Icon
                          name={selected === i ? "check" : "arrow"}
                          size={14}
                        />
                      </span>
                      {selected === i && (
                        <span className="selected-tag">SELECTED</span>
                      )}
                    </div>
                    <div className="map-info">
                      <h3>{m.name}</h3>
                      <span>
                        {tab === "records"
                          ? records[m.id]
                            ? formatTime(records[m.id])
                            : "NO RUN RECORDED"
                          : m.difficulty}
                      </span>
                      <div className="difficulty-bars">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <i
                            key={n}
                            className={
                              n < [1, 2, 2, 1, 4, 4, 5, 3][i] ? "filled" : ""
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="selected-details">
                <span>
                  <i />
                  {map.feature}
                </span>
                <p>{map.description}</p>
                <button onClick={launch}>
                  EXPLORE DISTRICT <Icon name="arrow" size={17} />
                </button>
              </div>
            </section>
            <ControlsGuide />
            <a
              className="odyssey-card"
              href="https://www.ark11space.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Local promotional artwork. */}
              <img
                src="/ark11space.webp"
                alt="ARK 11 Odyssey space adventure"
              />
              <div>
                <span className="eyebrow">BEYOND NEW EDEN</span>
                <h2>ARK 11 Odyssey</h2>
                <p>Pilot the ARK 11. A new adventure awaits among the stars.</p>
                <strong>PLAY ODYSSEY ↗</strong>
              </div>
            </a>
            <footer>
              <span className="footer-brand">
                <Logo /> BUILT FOR THE WAY YOU MOVE.
              </span>
              <span>A SMALL LEAP INTO THE FUTURE.</span>
              <button
                onClick={() => {
                  setStep(0);
                  setModal("guide");
                }}
              >
                <Icon name="keyboard" size={16} /> CONTROLS & MOVEMENT{" "}
                <Icon name="arrow" size={14} />
              </button>
              <span className="version">
                ASTRO RUNNER <b>V.01</b>
              </span>
            </footer>
          </>
        )}
      </main>
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <Icon name="close" />
            </button>
            {modal === "settings" ? (
              <>
                <div className="eyebrow">MAKE IT YOURS</div>
                <h2 id="modal-title">Fine-tune your flow.</h2>
                <p>Adjust how quickly the camera follows your mouse.</p>
                <label className="range-label">
                  Mouse sensitivity <span>{sensitivity.toFixed(1)}×</span>
                  <input
                    aria-label="Mouse sensitivity"
                    type="range"
                    min=".3"
                    max="2"
                    step=".1"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value))}
                  />
                </label>
                <button className="secondary" onClick={fullscreen}>
                  <Icon name="expand" /> Toggle fullscreen
                </button>
                <p className="small-note">
                  Best explored on desktop with a keyboard and mouse. Your best
                  times are saved on this device.
                </p>
                <button className="primary" onClick={() => setModal(null)}>
                  ALL SET <Icon name="check" />
                </button>
              </>
            ) : (
              <>
                <div className="onboard-top">
                  <span className="eyebrow">RUNNER ORIENTATION</span>
                  <span>
                    0{step + 1} / 0{orientation.length}
                  </span>
                </div>
                <div className="onboard-art">
                  {step === 0 ? (
                    <>
                      <div className="key-cluster">
                        <kbd>W</kbd>
                        <div>
                          <kbd>A</kbd>
                          <kbd>S</kbd>
                          <kbd>D</kbd>
                        </div>
                      </div>
                      <div className="orbit-art">
                        <span />
                        <Icon name="compass" size={62} />
                      </div>
                    </>
                  ) : step === 1 ? (
                    <>
                      <div className="jump-art">
                        <span />
                        <span />
                        <span />
                        <svg viewBox="0 0 220 100">
                          <path
                            d="M15 85Q60-55 110 45Q160-45 205 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray="5 5"
                          />
                          <circle cx="110" cy="45" r="6" fill="currentColor" />
                        </svg>
                      </div>
                    </>
                  ) : step === 2 ? (
                    <div className="route-art">
                      <Icon name="compass" size={48} />
                      <span>E · AIM. FIRE. REPOSITION.</span>
                      <div>LMB / F TO FIRE · R TO MOVE AGAIN</div>
                    </div>
                  ) : (
                    <div className="route-art">
                      <Icon name="flag" size={48} />
                      <span>FIND YOUR OWN WAY.</span>
                      <div>LOW ROUTE ── UPPER LANE ── YOUR ROUTE</div>
                    </div>
                  )}
                </div>
                <h2 id="modal-title">{orientation[step].title}</h2>
                <p>{orientation[step].description}</p>
                <div className="onboard-bottom">
                  <div className="steps">
                    {orientation.map((_, i) => (
                      <button
                        key={i}
                        className={i === step ? "active" : ""}
                        aria-label={`Step ${i + 1}`}
                        onClick={() => setStep(i)}
                      />
                    ))}
                  </div>
                  <button
                    className="primary"
                    onClick={() => {
                      if (step < orientation.length - 1) setStep(step + 1);
                      else {
                        try {
                          localStorage.setItem("astro-onboarded", "2");
                        } catch {}
                        start();
                      }
                    }}
                  >
                    {step === orientation.length - 1
                      ? "LET’S EXPLORE"
                      : "NEXT UP"}
                    <Icon name="arrow" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      
    </div>
  );
}
