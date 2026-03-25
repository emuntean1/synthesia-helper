import { useRef, useEffect, useCallback } from "react";
import type { NoteEvent } from "../types";
import {
  LOWEST_PITCH,
  HIGHEST_PITCH,
  isBlackKey,
  pitchToNoteName,
} from "../utils/noteHelpers";
import {
  WHITE_KEY_WIDTH,
  WHITE_KEY_COUNT,
  BLACK_KEY_WIDTH,
} from "./PianoKeyboard";

const CANVAS_HEIGHT = 500;
const PIXELS_PER_SECOND = 200; // how many pixels one second of music spans vertically

// Black key offsets — must match PianoKeyboard exactly
const blackKeyOffsets: Record<number, number> = {
  1: 0.6,
  3: 0.8,
  6: 0.6,
  8: 0.7,
  10: 0.8,
};

function getKeyX(pitch: number): { x: number; width: number } {
  // Count white keys from LOWEST_PITCH up to this pitch
  let whiteIndex = 0;
  for (let p = LOWEST_PITCH; p <= HIGHEST_PITCH; p++) {
    if (p === pitch) {
      if (isBlackKey(p)) {
        const noteInOctave = p % 12;
        const offset = blackKeyOffsets[noteInOctave] ?? 0.65;
        const x =
          (whiteIndex - 1 + offset) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
        return { x, width: BLACK_KEY_WIDTH };
      } else {
        return { x: whiteIndex * WHITE_KEY_WIDTH, width: WHITE_KEY_WIDTH - 1 };
      }
    }
    if (!isBlackKey(p)) {
      whiteIndex++;
    }
  }
  return { x: 0, width: WHITE_KEY_WIDTH };
}

interface FallingNotesProps {
  notes: NoteEvent[];
  currentTime: number;
  speed: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onActiveNotes: (active: Set<number>, colors: Map<number, string>, flash: Set<number>) => void;
  onSyncAudio?: (activeNotes: Array<{ pitch: number; startTime: number; duration: number; velocity: number }>) => void;
}

const RIGHT_HAND_COLOR = "#4a9eda";
const LEFT_HAND_COLOR = "#4eda8a";

export default function FallingNotes({
  notes,
  currentTime,
  speed,
  isPlaying,
  onTimeUpdate,
  onActiveNotes,
  onSyncAudio,
}: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const currentTimeRef = useRef(currentTime);

  const canvasWidth = WHITE_KEY_COUNT * WHITE_KEY_WIDTH;

  // Keep ref in sync
  currentTimeRef.current = currentTime;

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, time: number) => {
      ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);

      // Draw subtle hit-line glow at the bottom
      const glowGrad = ctx.createLinearGradient(0, CANVAS_HEIGHT - 40, 0, CANVAS_HEIGHT);
      glowGrad.addColorStop(0, "rgba(126, 184, 218, 0)");
      glowGrad.addColorStop(1, "rgba(126, 184, 218, 0.06)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, CANVAS_HEIGHT - 40, canvasWidth, 40);

      // The "hit line" is at the bottom of the canvas
      const hitLineY = CANVAS_HEIGHT;

      const FLASH_DURATION = 0.08; // seconds — brief white flash on attack
      const activeNotes = new Set<number>();
      const flashNotes = new Set<number>();
      const noteColors = new Map<number, string>();
      const audioNotes: Array<{ pitch: number; startTime: number; duration: number; velocity: number }> = [];

      for (const note of notes) {
        const color = note.hand === "left" ? LEFT_HAND_COLOR : RIGHT_HAND_COLOR;
        const NOTE_GAP = 2; // pixels trimmed off top to show re-attacks
        const blockHeight = Math.max(0, note.duration * PIXELS_PER_SECOND - NOTE_GAP);

        // A note's bottom edge hits the hit line when currentTime == note.startTime
        // So: bottomY = hitLineY - (note.startTime - time) * PIXELS_PER_SECOND
        const bottomY = hitLineY - (note.startTime - time) * PIXELS_PER_SECOND;
        const topY = bottomY - blockHeight;

        // Only draw if visible
        if (bottomY < 0 || topY > CANVAS_HEIGHT) continue;

        const { x, width } = getKeyX(note.pitch);

        // Draw the note block
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x + 1, topY, width - 2, blockHeight, 3);
        ctx.fill();

        // Draw note label above the block
        if (topY > 12) {
          ctx.fillStyle = "#fff";
          ctx.font = "10px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(pitchToNoteName(note.pitch), x + width / 2, topY - 4);
        }

        // Check if note is currently "active" (being played)
        if (time >= note.startTime && time < note.startTime + note.duration) {
          activeNotes.add(note.pitch);
          noteColors.set(note.pitch, color);
          audioNotes.push({ pitch: note.pitch, startTime: note.startTime, duration: note.duration, velocity: note.velocity });
          // Flash briefly on attack
          if (time - note.startTime < FLASH_DURATION) {
            flashNotes.add(note.pitch);
          }
        }
      }

      onActiveNotes(activeNotes, noteColors, flashNotes);
      onSyncAudio?.(audioNotes);
    },
    [notes, canvasWidth, onActiveNotes, onSyncAudio]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!isPlaying) {
      draw(ctx, currentTimeRef.current);
      return;
    }

    lastTimestampRef.current = 0;

    const animate = (timestamp: number) => {
      if (lastTimestampRef.current === 0) {
        lastTimestampRef.current = timestamp;
      }

      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      const newTime = currentTimeRef.current + delta * speed;
      currentTimeRef.current = newTime;
      onTimeUpdate(newTime);

      draw(ctx, newTime);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, speed, draw, onTimeUpdate]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={CANVAS_HEIGHT}
      style={{
        display: "block",
        margin: "0 auto",
        background: "#111128",
        borderRadius: "8px 8px 0 0",
      }}
    />
  );
}
