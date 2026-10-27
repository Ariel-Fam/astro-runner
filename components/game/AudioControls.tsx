"use client";
import { useEffect, useState } from "react";
import { defaultAudio, gameAudio, type AudioSettings } from "./audio";
export default function AudioControls() {
  const [settings, setSettings] = useState<AudioSettings>(defaultAudio);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("astro-audio") ?? "null");
        if (saved) {
          const next = { ...defaultAudio };
          for (const key of ["music", "effects"] as const)
            if (typeof saved[key] === "number")
              next[key] = Math.max(0, Math.min(1, saved[key]));
          for (const key of ["musicMuted", "effectsMuted"] as const)
            if (typeof saved[key] === "boolean") next[key] = saved[key];
          setSettings(next);
          gameAudio.configure(next);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const update = (patch: Partial<AudioSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    gameAudio.configure(next);
    try {
      localStorage.setItem("astro-audio", JSON.stringify(next));
    } catch {}
  };
  return (
    <details className="audio-mixer">
      <summary>♪ SOUND MIX</summary>
      {(["music", "effects"] as const).map((channel) => {
        const muted = channel === "music" ? "musicMuted" : "effectsMuted";
        return (
          <div className="audio-channel" key={channel}>
            <button
              aria-label={`${settings[muted] ? "Unmute" : "Mute"} ${channel}`}
              aria-pressed={settings[muted]}
              onClick={() => update({ [muted]: !settings[muted] })}
            >
              {settings[muted] ? "○" : "◉"}
            </button>
            <label>
              {channel === "music" ? "Music" : "Sound effects"}
              <input
                aria-label={`${channel} volume`}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings[channel]}
                onChange={(e) => update({ [channel]: Number(e.target.value) })}
              />
            </label>
            <output>
              {settings[muted]
                ? "OFF"
                : `${Math.round(settings[channel] * 100)}%`}
            </output>
          </div>
        );
      })}
    </details>
  );
}
