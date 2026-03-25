import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import FileUpload from "./components/FileUpload";
import PianoKeyboard from "./components/PianoKeyboard";
import FallingNotes from "./components/FallingNotes";
import SpeedControl from "./components/SpeedControl";
import { useAudioEngine } from "./hooks/useAudioEngine";
import type { ParsedMidi } from "./types";
import "./App.css";

function App() {
  const [midiData, setMidiData] = useState<ParsedMidi | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [noteColors, setNoteColors] = useState<Map<number, string>>(new Map());
  const [flashNotes, setFlashNotes] = useState<Set<number>>(new Set());
  const [soundfontLoading, setSoundfontLoading] = useState(false);
  const [activeHand, setActiveHand] = useState<"both" | "left" | "right">("both");

  const filteredNotes = useMemo(() => {
    if (!midiData || activeHand === "both") return midiData?.notes ?? [];
    return midiData.notes.filter((n) => n.hand === activeHand);
  }, [midiData, activeHand]);

  const { ensureLoaded, syncNotes, stopAll, resumeContext } = useAudioEngine();
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);

  const handleTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time;
    setCurrentTime(time);
  }, []);

  const handleActiveNotes = useCallback(
    (active: Set<number>, colors: Map<number, string>, flash: Set<number>) => {
      setActiveNotes(active);
      setNoteColors(colors);
      setFlashNotes(flash);
    },
    []
  );

  const handleSyncAudio = useCallback(
    (active: Array<{ pitch: number; startTime: number; duration: number; velocity: number }>) => {
      if (!isPlayingRef.current || isDraggingRef.current) return;
      syncNotes(active);
    },
    [syncNotes]
  );

  const handlePlayPause = useCallback(() => {
    resumeContext();
    if (isPlaying) {
      isPlayingRef.current = false;
      stopAll();
      setIsPlaying(false);
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, [isPlaying, resumeContext, stopAll]);

  const seekTo = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, midiData?.duration ?? 0));
      setCurrentTime(clamped);
      currentTimeRef.current = clamped;
      if (isPlaying) {
        stopAll();
      }
    },
    [midiData, isPlaying, stopAll]
  );

  const handleSkip = useCallback(
    (delta: number) => {
      seekTo(currentTimeRef.current + delta);
    },
    [seekTo]
  );

  const progressRef = useRef<HTMLDivElement>(null);
  const wasPlayingBeforeDrag = useRef(false);

  const seekFromX = useCallback(
    (clientX: number) => {
      if (!midiData || !progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = fraction * midiData.duration;
      setCurrentTime(time);
      currentTimeRef.current = time;
    },
    [midiData]
  );

  const handleProgressDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      isDraggingRef.current = true;
      wasPlayingBeforeDrag.current = isPlaying;
      if (isPlaying) {
        isPlayingRef.current = false;
        stopAll();
        setIsPlaying(false);
      }
      seekFromX(e.clientX);
    },
    [seekFromX, isPlaying, stopAll]
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      seekFromX(e.clientX);
    };
    const handleUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (wasPlayingBeforeDrag.current) {
        isPlayingRef.current = true;
        setIsPlaying(true);
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [seekFromX]);

  const handleReset = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    stopAll();
    setCurrentTime(0);
    currentTimeRef.current = 0;
  }, [stopAll]);

  const handleParsed = useCallback(
    async (data: ParsedMidi) => {
      setMidiData(data);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopAll();
      setSoundfontLoading(true);
      await ensureLoaded();
      setSoundfontLoading(false);
    },
    [stopAll, ensureLoaded]
  );

  const progress =
    midiData && midiData.duration > 0
      ? Math.min(100, (currentTime / midiData.duration) * 100)
      : 0;

  // Auto-stop at end
  useEffect(() => {
    if (isPlaying && midiData && currentTime >= midiData.duration) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopAll();
    }
  }, [isPlaying, midiData, currentTime, stopAll]);

  const formatTime = (t: number) => {
    const mins = Math.floor(Math.max(0, t) / 60);
    const secs = Math.floor(Math.max(0, t) % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="app">
      <h1>Synthesia</h1>
      <FileUpload onParsed={handleParsed} />

      {soundfontLoading && (
        <div className="loading-overlay">
          <span className="spinner" />
          Loading piano sounds...
        </div>
      )}

      <SpeedControl
        speed={speed}
        onSpeedChange={setSpeed}
        baseBpm={midiData?.bpm ?? 120}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        onSkip={handleSkip}
        hasData={!!midiData}
      />

      {midiData && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <span style={{ color: "#888", fontSize: 13, marginRight: 4 }}>Hand:</span>
          {(["both", "right", "left"] as const).map((h) => (
            <button
              key={h}
              onClick={() => setActiveHand(h)}
              style={{
                padding: "6px 14px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                backgroundColor: activeHand === h ? (h === "right" ? "#4a9eda" : h === "left" ? "#4eda8a" : "#7eb8da") : "#2a2a3e",
                color: activeHand === h ? "#1a1a2e" : "#aaa",
                fontWeight: activeHand === h ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {h === "both" ? "Both" : h === "right" ? "Right" : "Left"}
            </button>
          ))}
        </div>
      )}

      {midiData && (
        <>
          <div className="info-bar">
            {midiData.notes.length} notes | {midiData.bpm} BPM |{" "}
            {formatTime(currentTime)} / {formatTime(midiData.duration)}
          </div>
          <div
            ref={progressRef}
            className="progress-container"
            onMouseDown={handleProgressDown}
            title="Click or drag to seek"
          >
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      <div className="canvas-container">
        <FallingNotes
          notes={filteredNotes}
          currentTime={currentTime}
          speed={speed}
          isPlaying={isPlaying}
          onTimeUpdate={handleTimeUpdate}
          onActiveNotes={handleActiveNotes}
          onSyncAudio={handleSyncAudio}
        />
      </div>
      <PianoKeyboard activeNotes={activeNotes} noteColors={noteColors} flashNotes={flashNotes} />
    </div>
  );
}

export default App;
