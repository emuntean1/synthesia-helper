import mido


NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

RIGHT_HAND_KEYWORDS = {"right", "rh", "treble", "melody", "soprano"}
LEFT_HAND_KEYWORDS = {"left", "lh", "bass", "accomp"}


def pitch_to_name(pitch: int) -> str:
    """Convert MIDI pitch number to note name (e.g., 60 -> 'C4')."""
    octave = (pitch // 12) - 1
    note = NOTE_NAMES[pitch % 12]
    return f"{note}{octave}"


def _detect_hand_by_name(track_name: str) -> str | None:
    """Detect hand assignment from track name keywords. Returns 'left', 'right', or None."""
    if not track_name:
        return None
    name_lower = track_name.lower()
    for kw in RIGHT_HAND_KEYWORDS:
        if kw in name_lower:
            return "right"
    for kw in LEFT_HAND_KEYWORDS:
        if kw in name_lower:
            return "left"
    return None


def parse_midi(file_path: str) -> dict:
    """Parse a MIDI file and return structured note data."""
    midi = mido.MidiFile(file_path)

    ticks_per_beat = midi.ticks_per_beat

    # Extract initial tempo
    tempo = 500000  # default 120 BPM

    # Build tempo map from all tracks: list of (absolute_tick, tempo)
    tempo_map: list[tuple[int, int]] = []
    for track in midi.tracks:
        abs_tick = 0
        for msg in track:
            abs_tick += msg.time
            if msg.type == 'set_tempo':
                tempo_map.append((abs_tick, msg.tempo))

    tempo_map.sort(key=lambda t: t[0])
    if tempo_map:
        tempo = tempo_map[0][1]
    else:
        tempo_map = [(0, tempo)]

    bpm = mido.tempo2bpm(tempo)

    def ticks_to_seconds(tick: int) -> float:
        """Convert absolute tick to seconds, accounting for tempo changes."""
        seconds = 0.0
        prev_tick = 0
        current_tempo = tempo_map[0][1]

        for change_tick, new_tempo in tempo_map:
            if change_tick >= tick:
                break
            delta = change_tick - prev_tick
            seconds += mido.tick2second(delta, ticks_per_beat, current_tempo)
            prev_tick = change_tick
            current_tempo = new_tempo

        delta = tick - prev_tick
        seconds += mido.tick2second(delta, ticks_per_beat, current_tempo)
        return seconds

    notes = []

    # --- Build track metadata ---
    track_info = []
    note_track_indices = []
    name_hands: dict[int, str] = {}  # track_idx -> hand from name keywords

    for i, track in enumerate(midi.tracks):
        note_count = sum(1 for m in track if m.type in ('note_on', 'note_off'))
        has_notes = note_count > 0
        if has_notes:
            note_track_indices.append(i)

        hand_from_name = _detect_hand_by_name(track.name)
        if hand_from_name and has_notes:
            name_hands[i] = hand_from_name

        info = {"index": i, "name": track.name or "", "noteCount": note_count // 2}
        track_info.append(info)

    # Check if multiple channels are used across all tracks
    all_channels = set()
    for track in midi.tracks:
        for msg in track:
            if msg.type in ('note_on', 'note_off') and hasattr(msg, 'channel'):
                all_channels.add(msg.channel)

    # Determine hand assignment strategy (priority order):
    # 1. Track name keywords (highest priority)
    # 2. Multiple note tracks -> assign by track position (first=right, rest=left)
    # 3. Multiple channels -> assign by channel (ch0=right, ch1=left)
    # 4. Dynamic pitch split (single track, single channel, no name hints)
    use_name = len(name_hands) > 0
    use_track = not use_name and len(note_track_indices) >= 2
    use_channel = not use_name and not use_track and len(all_channels) >= 2
    use_fallback = not use_name and not use_track and not use_channel

    for track_idx, track in enumerate(midi.tracks):
        active_notes: dict[tuple[int, int], tuple[int, int]] = {}
        abs_tick = 0

        # Determine track-level hand (if applicable)
        if use_name and track_idx in name_hands:
            track_hand = name_hands[track_idx]
        elif use_name:
            # Name-based detection active but this track has no keyword — use position
            if track_idx in note_track_indices:
                pos = note_track_indices.index(track_idx)
                track_hand = "left" if pos >= 1 else "right"
            else:
                track_hand = "right"
        elif use_track:
            pos = note_track_indices.index(track_idx) if track_idx in note_track_indices else -1
            track_hand = "left" if pos >= 1 else "right"
        else:
            track_hand = None

        for msg in track:
            abs_tick += msg.time

            if msg.type == 'note_on' and msg.velocity > 0:
                active_notes[(msg.note, msg.channel)] = (abs_tick, msg.velocity)

            elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                key = (msg.note, msg.channel)
                if key in active_notes:
                    start_tick, velocity = active_notes.pop(key)
                    start_time = ticks_to_seconds(start_tick)
                    end_time = ticks_to_seconds(abs_tick)

                    if track_hand:
                        hand = track_hand
                    elif use_channel:
                        hand = "left" if msg.channel == 1 else "right"
                    else:
                        hand = "right"

                    notes.append({
                        "pitch": msg.note,
                        "name": pitch_to_name(msg.note),
                        "startTime": round(start_time, 4),
                        "duration": round(end_time - start_time, 4),
                        "velocity": velocity,
                        "hand": hand,
                        "channel": msg.channel,
                    })

    notes.sort(key=lambda n: (n["startTime"], n["pitch"]))

    # Add hand info to trackInfo for diagnostics
    for info in track_info:
        idx = info["index"]
        if idx in name_hands:
            info["hand"] = name_hands[idx]
        elif use_track and idx in note_track_indices:
            pos = note_track_indices.index(idx)
            info["hand"] = "left" if pos >= 1 else "right"

    total_duration = max((n["startTime"] + n["duration"] for n in notes), default=0)

    strategy = "name" if use_name else "track" if use_track else "channel" if use_channel else "none"

    return {
        "bpm": round(bpm, 2),
        "duration": round(total_duration, 4),
        "handDetection": strategy,
        "trackInfo": track_info,
        "notes": notes,
    }
