import { AbsoluteFill, Easing, Freeze, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { TakeName } from "./footage";

/** A punch-in keyframe: at local frame `at`, magnify by `scale` around `focus` (1920x1080 space). */
export type Push = { at: number; scale: number; focus: [number, number] };

/**
 * A speed keyframe: from local frame `at`, the take plays at `rate` (1 is true speed, 0 a freeze
 * frame). Rates hold until the next key.
 */
export type Speed = { at: number; rate: number };

/** Source frames played (relative to the shot's start) by local frame `frame` under `speed`. */
export function sourceOffset(frame: number, speed: Speed[] = []): number {
  if (!speed.length) return frame;
  let offset = Math.min(frame, speed[0].at);
  for (let index = 0; index < speed.length; index++) {
    const start = speed[index].at;
    const end = speed[index + 1]?.at ?? Infinity;
    if (frame <= start) break;
    offset += (Math.min(frame, end) - start) * speed[index].rate;
  }
  return offset;
}

/** First local frame at which `sourceFrames` of the take have played under `speed`. */
export function localLength(sourceFrames: number, speed: Speed[] = []): number {
  if (!speed.length) return Math.max(0, Math.ceil(sourceFrames));
  let frame = 0;
  while (sourceOffset(frame, speed) < sourceFrames - 1e-6) {
    frame++;
    if (frame > 100_000) throw new Error(`Speed keys never reach source frame ${sourceFrames}`);
  }
  return frame;
}

// The game's own top bar (wordmark, turn chip, toolbar and their shadows) fills the top
// CHROME_HEIGHT pixels of a desktop take. A punch-in either keeps it whole or crops it away
// entirely: `hideChrome` holds the frame below it.
export const CHROME_HEIGHT = 128;

/**
 * One recorded take, trimmed. Desktop takes are captured at 2x pixel density, so punching in up to
 * 2x stays sharp. Pushes ease between keyframes and never expose an edge. `kicks` add a short
 * zoom pulse (piece impacts). With `hideChrome`, the frame never shows any of the game's top bar
 * (pushes must magnify at least 1.14x for there to be room).
 */
export const Shot: React.FC<{
  take: TakeName;
  from: number;
  push?: Push[];
  speed?: Speed[];
  kicks?: number[];
  hideChrome?: boolean;
}> = ({ take, from, push = [], speed, kicks = [], hideChrome = false }) => {
  const frame = useCurrentFrame();
  const keys = push.length ? push : [{ at: 0, scale: 1, focus: [960, 540] as [number, number] }];
  const times = keys.map((key) => key.at);
  const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const pick = (values: number[]) => (keys.length === 1 ? values[0] : interpolate(frame, times, values, ease));
  const kick = kicks.reduce((total, at) => {
    const t = frame - at;
    return t < 0 || t > 16 ? total : total + 0.03 * Math.exp(-t / 4.5) * Math.min(1, t / 2);
  }, 0);
  const scale = pick(keys.map((key) => key.scale)) * (1 + kick);
  const fx = pick(keys.map((key) => key.focus[0]));
  const fy = pick(keys.map((key) => key.focus[1]));
  const tx = Math.min(0, Math.max(1920 - 1920 * scale, 960 - fx * scale));
  const top = hideChrome ? -CHROME_HEIGHT * scale : 0;
  const ty = Math.min(top, Math.max(1080 - 1080 * scale, 540 - fy * scale));
  const video = <OffthreadVideo src={staticFile(`footage/${take}.mp4`)} trimBefore={from} muted style={{ width: "100%", height: "100%" }} />;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        {speed ? <Freeze frame={Math.round(sourceOffset(frame, speed))}>{video}</Freeze> : video}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
