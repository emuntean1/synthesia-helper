import { useMemo } from "react";
import { getKeyboardKeys, WHITE_KEY_COUNT } from "../utils/noteHelpers";

const WHITE_KEY_WIDTH = 24;
const WHITE_KEY_HEIGHT = 120;
const BLACK_KEY_WIDTH = 14;
const BLACK_KEY_HEIGHT = 75;

interface PianoKeyboardProps {
  activeNotes?: Set<number>;
  noteColors?: Map<number, string>;
  flashNotes?: Set<number>;
}

export default function PianoKeyboard({ activeNotes, noteColors, flashNotes }: PianoKeyboardProps) {
  const keys = useMemo(() => getKeyboardKeys(), []);
  const totalWidth = WHITE_KEY_COUNT * WHITE_KEY_WIDTH;

  // Black key offsets relative to their preceding white key
  // Pattern within an octave: C C# D D# E F F# G G# A A# B
  const blackKeyOffsets: Record<number, number> = {
    1: 0.6,   // C#
    3: 0.8,   // D#
    6: 0.6,   // F#
    8: 0.7,   // G#
    10: 0.8,  // A#
  };

  const whiteKeys = keys.filter((k) => !k.isBlack);
  const blackKeys = keys.filter((k) => k.isBlack);

  return (
    <div
      style={{
        position: "relative",
        width: totalWidth,
        height: WHITE_KEY_HEIGHT,
        margin: "0 auto",
        userSelect: "none",
      }}
    >
      {/* White keys */}
      {whiteKeys.map((key, i) => {
        const isActive = activeNotes?.has(key.pitch);
        const isFlash = flashNotes?.has(key.pitch);
        const color = noteColors?.get(key.pitch);
        return (
          <div
            key={key.pitch}
            style={{
              position: "absolute",
              left: i * WHITE_KEY_WIDTH,
              top: 0,
              width: WHITE_KEY_WIDTH - 1,
              height: WHITE_KEY_HEIGHT,
              backgroundColor: isFlash ? "#fff" : isActive && color ? color : "#f8f8f8",
              border: "1px solid #333",
              borderRadius: "0 0 4px 4px",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 4,
              fontSize: 8,
              color: "#666",
              transition: "background-color 0.05s",
            }}
          >
            {key.name}
          </div>
        );
      })}

      {/* Black keys */}
      {blackKeys.map((key) => {
        const noteInOctave = key.pitch % 12;
        const offset = blackKeyOffsets[noteInOctave] ?? 0.65;
        const left = (key.whiteKeyIndex + offset) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
        const isActive = activeNotes?.has(key.pitch);
        const isFlash = flashNotes?.has(key.pitch);
        const color = noteColors?.get(key.pitch);

        return (
          <div
            key={key.pitch}
            style={{
              position: "absolute",
              left,
              top: 0,
              width: BLACK_KEY_WIDTH,
              height: BLACK_KEY_HEIGHT,
              backgroundColor: isFlash ? "#fff" : isActive && color ? color : "#222",
              border: "1px solid #000",
              borderRadius: "0 0 3px 3px",
              boxSizing: "border-box",
              zIndex: 1,
              transition: "background-color 0.05s",
            }}
          />
        );
      })}
    </div>
  );
}

export { WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT, WHITE_KEY_COUNT, BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT };