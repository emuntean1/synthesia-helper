interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  baseBpm: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onSkip: (delta: number) => void;
  hasData: boolean;
}

const BPM_MIN = 40;
const BPM_MAX = 160;
const BPM_STEP = 20;
const BPM_STEPS = (BPM_MAX - BPM_MIN) / BPM_STEP; // 6 steps

export default function SpeedControl({
  speed,
  onSpeedChange,
  baseBpm,
  isPlaying,
  onPlayPause,
  onReset,
  onSkip,
  hasData,
}: SpeedControlProps) {
  const currentBpm = Math.round(baseBpm * speed);

  // Snap slider value to nearest step
  const sliderValue = Math.round((currentBpm - BPM_MIN) / BPM_STEP);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bpm = BPM_MIN + Number(e.target.value) * BPM_STEP;
    onSpeedChange(bpm / baseBpm);
  };

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
      <button
        onClick={onPlayPause}
        disabled={!hasData}
        style={{
          ...btnBase(hasData),
          backgroundColor: hasData ? (isPlaying ? "#c04040" : "#3a7a3a") : "#333",
          color: hasData ? "#fff" : "#666",
          minWidth: 72,
        }}
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <button onClick={onReset} disabled={!hasData} style={btnBase(hasData)}>
        Reset
      </button>
      <div style={{ width: 4 }} />
      <button onClick={() => onSkip(-5)} disabled={!hasData} style={btnBase(hasData)}>
        -5s
      </button>
      <button onClick={() => onSkip(5)} disabled={!hasData} style={btnBase(hasData)}>
        +5s
      </button>
      <div style={{ width: 8 }} />
      <span style={{ color: "#888", fontSize: 13 }}>BPM:</span>
      <input
        type="range"
        min={0}
        max={BPM_STEPS}
        step={1}
        value={sliderValue}
        onChange={handleSlider}
        disabled={!hasData}
        style={{ width: 120, accentColor: "#7eb8da" }}
      />
      <span
        style={{
          color: hasData ? "#eee" : "#666",
          fontSize: 14,
          fontVariantNumeric: "tabular-nums",
          minWidth: 28,
          textAlign: "center",
        }}
      >
        {currentBpm}
      </span>
    </div>
  );
}

function btnBase(enabled: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    backgroundColor: "#2a2a3e",
    color: enabled ? "#eee" : "#666",
    cursor: enabled ? "pointer" : "default",
    fontSize: 14,
    fontFamily: "inherit",
    transition: "all 0.15s",
  };
}
