import type { CSSProperties } from "react";
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    expand: (
      <>
        <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
      </>
    ),
    play: <path d="m9 5 11 7-11 7z" />,
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="17" r="3" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4m0 0c5-4 9 4 15 0v10c-6 4-10-4-15 0" />
      </>
    ),
    sound: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8L21 9h-8z" />,
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-3 5-5 3 3-5z" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L20 5" />,
    keyboard: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M5 9h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h2m2 0h2m2 0h2M6 16h12" />
      </>
    ),
    pause: <path d="M8 5v14M16 5v14" />,
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {paths[name] || paths.arrow}
    </svg>
  );
}
export function Logo() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M6 30 18 7h7L13 30H6Zm14 0 8-15 7 15H20Z" fill="currentColor" />
      <path d="M5 35h30" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
export function MapArt({ seed, color }: { seed: number; color: string }) {
  return (
    <svg viewBox="0 0 220 110" className="map-art" aria-hidden="true">
      <defs>
        <linearGradient id={`g${seed}`} x2="0" y2="1">
          <stop stopColor={color} stopOpacity=".18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 89 220 30M0 110 220 51M30 110 220 72M0 68 151 27M68 110 220 93"
        stroke={color}
        opacity=".1"
      />
      {Array.from({ length: 12 }, (_, i) => {
        const x = 10 + ((i * 37 + seed * 7) % 180),
          y = 45 + ((i * 17) % 32),
          h = 15 + ((i * 13 + seed) % 50);
        return (
          <g key={i}>
            <path d={`M${x} ${y}l17-8 17 8-17 9z`} fill={color} opacity=".35" />
            <path
              d={`M${x} ${y}v${h}l17 9V${y + 9}z`}
              fill={color}
              opacity=".13"
            />
            <path
              d={`M${x + 17} ${y + 9}v${h}l17-9V${y}z`}
              fill={`url(#g${seed})`}
              stroke={color}
              strokeOpacity=".26"
              strokeWidth=".5"
            />
          </g>
        );
      })}
      <path
        d="m35 70 37-17 25 12 40-28 44 18"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="3 4"
        fill="none"
      />
      <circle cx="181" cy="55" r="3" fill={color} />
    </svg>
  );
}
