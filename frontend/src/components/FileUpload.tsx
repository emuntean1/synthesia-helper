import { useCallback, useState } from "react";
import type { ParsedMidi } from "../types";

interface FileUploadProps {
  onParsed: (data: ParsedMidi) => void;
}

export default function FileUpload({ onParsed }: FileUploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().match(/\.(midi?|musicxml|mxl|xml)$/)) {
        setError("Please select a MIDI or MusicXML file");
        return;
      }

      setLoading(true);
      setError(null);
      setFileName(file.name);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("http://localhost:5001/api/parse", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to parse MIDI file");
          return;
        }
        if (!data.notes || data.notes.length === 0) {
          setError("No notes found in this MIDI file");
          return;
        }
        onParsed(data);
      } catch {
        setError("Could not connect to backend. Is the server running?");
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      style={{
        border: `2px dashed ${dragOver ? "#7eb8da" : "#444"}`,
        borderRadius: 8,
        padding: "16px 32px",
        textAlign: "center",
        color: "#aaa",
        cursor: "pointer",
        marginBottom: 16,
        background: dragOver ? "rgba(126,184,218,0.05)" : "transparent",
        transition: "all 0.2s",
        minWidth: 320,
      }}
      onClick={() => document.getElementById("midi-input")?.click()}
    >
      <input
        id="midi-input"
        type="file"
        accept=".mid,.midi,.musicxml,.mxl,.xml"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      {loading ? (
        <span>
          <span
            className="spinner"
            style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8 }}
          />
          Parsing...
        </span>
      ) : fileName && !error ? (
        <span style={{ color: "#4eda8a" }}>{fileName}</span>
      ) : (
        <span>Drop a MIDI or MusicXML file here or click to browse</span>
      )}
      {error && <div style={{ color: "#e55", marginTop: 8, fontSize: 13 }}>{error}</div>}
    </div>
  );
}
