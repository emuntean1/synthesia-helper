// Piano key layout: 88 keys from A0 (pitch 21) to C8 (pitch 108)
export const LOWEST_PITCH = 21; // A0
export const HIGHEST_PITCH = 108; // C8
export const TOTAL_KEYS = 88;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function isBlackKey(pitch: number): boolean {
  const note = pitch % 12;
  return [1, 3, 6, 8, 10].includes(note);
}

export function pitchToNoteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const note = NOTE_NAMES[pitch % 12];
  return `${note}${octave}`;
}

// Generate all 88 keys with their properties
export interface KeyInfo {
  pitch: number;
  name: string;
  isBlack: boolean;
  whiteKeyIndex: number; // index among white keys only (0-51)
}

export function getKeyboardKeys(): KeyInfo[] {
  const keys: KeyInfo[] = [];
  let whiteKeyIndex = 0;

  for (let pitch = LOWEST_PITCH; pitch <= HIGHEST_PITCH; pitch++) {
    const black = isBlackKey(pitch);
    keys.push({
      pitch,
      name: pitchToNoteName(pitch),
      isBlack: black,
      whiteKeyIndex: black ? whiteKeyIndex - 1 : whiteKeyIndex,
    });
    if (!black) {
      whiteKeyIndex++;
    }
  }

  return keys;
}

export const WHITE_KEY_COUNT = 52;
export const BLACK_KEY_COUNT = 36;
