export type AudioSettings = {
  music: number;
  effects: number;
  musicMuted: boolean;
  effectsMuted: boolean;
};
export const defaultAudio: AudioSettings = {
  music: 0.35,
  effects: 0.65,
  musicMuted: false,
  effectsMuted: false,
};
type Sound =
  | "footsteps"
  | "hover"
  | "ship"
  | "character"
  | "impact"
  | "jump"
  | "landing"
  | "falling"
  | "music";
const files: Record<Sound, string> = {
  footsteps: "footSteps.mp3",
  hover: "shipsHovering.mp3",
  ship: "shipShot.mp3",
  character: "characterShot.mp3",
  impact: "impact.mp3",
  jump: "jump.mp3",
  landing: "landing.mp3",
  falling: "falling.mp3",
  music: "5.Pulsar.wav",
};
class GameAudio {
  settings = defaultAudio;
  active = false;
  private unlocked = false;
  private loops = new Map<Sound, HTMLAudioElement>();
  private voices: { sound: Sound; audio: HTMLAudioElement; gain: number }[] =
    [];
  private gains = new Map<Sound, number>();
  private volume(sound: Sound, gain: number) {
    const music = sound === "music";
    return this.active
      ? gain *
          (music
            ? this.settings.musicMuted
              ? 0
              : this.settings.music
            : this.settings.effectsMuted
              ? 0
              : this.settings.effects)
      : 0;
  }
  unlock() {
    this.unlocked = true;
    this.setActive(true);
    this.loop("music", 0.65);
  }
  configure(settings: AudioSettings) {
    this.settings = settings;
    for (const [sound, audio] of this.loops)
      audio.volume = this.volume(sound, this.gains.get(sound) ?? 0);
    for (const voice of this.voices)
      voice.audio.volume = this.volume(voice.sound, voice.gain);
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      for (const audio of this.loops.values()) audio.pause();
      for (const voice of this.voices) voice.audio.pause();
    } else if (this.unlocked) this.loop("music", 0.65);
  }
  loop(sound: Sound, gain: number, rate = 1) {
    if (!this.unlocked) return;
    let audio = this.loops.get(sound);
    if (!audio) {
      audio = new Audio(`/sfx/${files[sound]}`);
      audio.loop = true;
      this.loops.set(sound, audio);
    }
    this.gains.set(sound, gain);
    audio.volume = this.volume(sound, gain);
    audio.playbackRate = rate;
    if (this.active && gain > 0) {
      if (audio.paused) void audio.play().catch(() => {});
    } else audio.pause();
  }
  shot(sound: "ship" | "character" | "impact" | "jump" | "landing", gain = 1) {
    if (!this.unlocked || !this.active || !this.volume(sound, gain)) return;
    this.voices = this.voices.filter((v) => !v.audio.ended && !v.audio.paused);
    if (this.voices.length >= 16) this.voices.shift()?.audio.pause();
    const audio = new Audio(`/sfx/${files[sound]}`);
    audio.volume = this.volume(sound, gain);
    this.voices.push({ sound, audio, gain });
    void audio.play().catch(() => {});
  }
}
export const gameAudio = new GameAudio();
