import { useRef, useCallback, useEffect } from "react";
import Soundfont from "soundfont-player";
import { pitchToNoteName } from "../utils/noteHelpers";

export function useAudioEngine() {
  const acRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<Soundfont.Player | null>(null);
  const loadPromiseRef = useRef<Promise<Soundfont.Player | null> | null>(null);
  // Track which notes are currently sounding: key = "pitch-startTime"
  const activeHandles = useRef<Map<string, { stop: (time?: number) => void }>>(new Map());

  const getAudioContext = useCallback(() => {
    if (!acRef.current) {
      acRef.current = new AudioContext();
    }
    if (acRef.current.state === "suspended") {
      acRef.current.resume();
    }
    return acRef.current;
  }, []);

  const ensureLoaded = useCallback((): Promise<Soundfont.Player | null> => {
    if (playerRef.current) return Promise.resolve(playerRef.current);
    if (loadPromiseRef.current) return loadPromiseRef.current;

    const ac = getAudioContext();
    console.log("[audio] Loading piano soundfont...");
    loadPromiseRef.current = Soundfont.instrument(ac, "acoustic_grand_piano", {
      soundfont: "MusyngKite",
      format: "mp3",
    })
      .then((piano) => {
        console.log("[audio] Piano loaded successfully");
        playerRef.current = piano;
        return piano;
      })
      .catch((e) => {
        console.error("[audio] Failed to load piano:", e);
        loadPromiseRef.current = null;
        return null;
      });

    return loadPromiseRef.current;
  }, [getAudioContext]);

  // Call this every animation frame with the set of currently active note keys
  // It will start notes that just became active and stop notes that ended
  const syncNotes = useCallback(
    (activeNotes: Array<{ pitch: number; startTime: number; duration: number; velocity: number }>) => {
      const piano = playerRef.current;
      if (!piano) return;

      const currentKeys = new Set<string>();

      for (const note of activeNotes) {
        const key = `${note.pitch}-${note.startTime}`;
        currentKeys.add(key);

        // Start note if not already playing
        if (!activeHandles.current.has(key)) {
          const noteName = pitchToNoteName(note.pitch);
          const gain = note.velocity / 127;
          const handle = piano.play(noteName, 0, { duration: note.duration, gain });
          activeHandles.current.set(key, handle);
        }
      }

      // Stop notes that are no longer active
      for (const [key, handle] of activeHandles.current) {
        if (!currentKeys.has(key)) {
          try {
            handle.stop();
          } catch {
            // ignore
          }
          activeHandles.current.delete(key);
        }
      }
    },
    []
  );

  const stopAll = useCallback(() => {
    for (const [, handle] of activeHandles.current) {
      try {
        handle.stop();
      } catch {
        // ignore
      }
    }
    activeHandles.current.clear();
    try {
      playerRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  // Call synchronously from click handler to unlock audio
  const resumeContext = useCallback(() => {
    const ac = getAudioContext();
    console.log("[audio] AudioContext state:", ac.state);
  }, [getAudioContext]);

  useEffect(() => {
    return () => {
      stopAll();
      acRef.current?.close();
    };
  }, [stopAll]);

  return { ensureLoaded, syncNotes, stopAll, resumeContext };
}
