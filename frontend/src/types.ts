export interface NoteEvent {
  pitch: number;
  name: string;
  startTime: number;
  duration: number;
  velocity: number;
  hand: "left" | "right";
  channel: number;
}

export interface ParsedMidi {
  bpm: number;
  duration: number;
  notes: NoteEvent[];
}
