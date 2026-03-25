import music21

from midi_parser import pitch_to_name


def parse_musicxml(file_path: str) -> dict:
    score = music21.converter.parse(file_path)

    # Extract tempo
    bpm = 120.0
    marks = score.metronomeMarkBoundaries()
    if marks:
        bpm = marks[0][2].number
    seconds_per_quarter = 60.0 / bpm

    notes = []
    track_info = []
    num_parts = len(score.parts)
    has_clef_detection = False

    for part_idx, part in enumerate(score.parts):
        part_name = part.partName or ""
        part_notes_count = 0

        # Track pitches currently held by ties: midi -> {start, end, velocity, hand}
        # This handles arpeggio build-ups where notes enter one by one over tied
        # chords — stripTies() can't resolve these because individual pitch ties
        # span Note→Chord boundaries.
        tied = {}

        for element in part.flatten().notes:
            # Skip grace notes (zero duration, often notated with slurs)
            if element.quarterLength == 0:
                continue

            offset = float(element.offset)
            ql = float(element.quarterLength)
            end = offset + ql

            hand = _detect_hand(element, part_idx, num_parts)
            if hand[1] == "clef":
                has_clef_detection = True
            velocity = element.volume.velocity if element.volume.velocity is not None else 64

            # Collect MIDI pitches from this element
            if isinstance(element, music21.chord.Chord):
                midi_vals = [p.midi for p in element.pitches]
            else:
                midi_vals = [element.pitch.midi]

            # Update tie tracking for each pitch
            for midi in midi_vals:
                if midi in tied:
                    # Pitch already sounding — extend its duration
                    tied[midi]["end"] = end
                else:
                    # New pitch — start tracking
                    tied[midi] = {
                        "start": offset,
                        "end": end,
                        "velocity": velocity,
                        "hand": hand[0],
                    }

            # On tie=stop or no tie, emit and release tracked pitches
            tie = getattr(element, "tie", None)
            if tie is None or tie.type == "stop":
                for midi in midi_vals:
                    info = tied.pop(midi, None)
                    if info:
                        total_ql = info["end"] - info["start"]
                        notes.append(_make_note(
                            int(midi),
                            info["start"] * seconds_per_quarter,
                            total_ql * seconds_per_quarter,
                            int(info["velocity"]),
                            info["hand"],
                        ))
                        part_notes_count += 1

        # Emit any remaining held pitches (tie chain reached end of part)
        for midi, info in tied.items():
            total_ql = info["end"] - info["start"]
            notes.append(_make_note(
                int(midi),
                info["start"] * seconds_per_quarter,
                total_ql * seconds_per_quarter,
                int(info["velocity"]),
                info["hand"],
            ))
            part_notes_count += 1

        track_info.append({
            "index": part_idx,
            "name": part_name,
            "noteCount": part_notes_count,
            "hand": "right" if part_idx == 0 else "left",
        })

    # Deduplicate notes at the same pitch + startTime (multi-voice parts
    # can produce overlapping elements where an early copy has velocity 0).
    # Keep the highest velocity and longest duration for each pair.
    seen: dict[tuple[int, float], int] = {}
    deduped: list[dict] = []
    for note in notes:
        key = (note["pitch"], note["startTime"])
        if key in seen:
            existing = deduped[seen[key]]
            existing["velocity"] = max(existing["velocity"], note["velocity"])
            existing["duration"] = max(existing["duration"], note["duration"])
        else:
            seen[key] = len(deduped)
            deduped.append(note)
    notes = deduped

    notes.sort(key=lambda n: (n["startTime"], n["pitch"]))
    total_duration = max((n["startTime"] + n["duration"] for n in notes), default=0)

    if num_parts >= 2:
        detection = "part"
    elif has_clef_detection:
        detection = "clef"
    else:
        detection = "none"

    return {
        "bpm": round(bpm, 2),
        "duration": round(total_duration, 4),
        "handDetection": detection,
        "trackInfo": track_info,
        "notes": notes,
    }


def _detect_hand(element, part_idx: int, num_parts: int) -> tuple[str, str]:
    """Returns (hand, method) where method is 'part' or 'clef'."""
    if num_parts >= 2:
        return ("right" if part_idx == 0 else "left", "part")

    clef = element.getContextByClass(music21.clef.Clef)
    if clef is not None:
        if isinstance(clef, music21.clef.BassClef):
            return ("left", "clef")
        return ("right", "clef")

    return ("right", "none")


def _make_note(midi_pitch: int, start: float, duration: float, velocity: int, hand: str) -> dict:
    return {
        "pitch": midi_pitch,
        "name": pitch_to_name(midi_pitch),
        "startTime": round(start, 4),
        "duration": round(duration, 4),
        "velocity": int(velocity),
        "hand": hand,
        "channel": 0,
    }
