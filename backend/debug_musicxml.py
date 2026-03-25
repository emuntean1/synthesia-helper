"""Debug script: inspect what music21 returns for a MusicXML file.
Usage: python debug_musicxml.py <path_to_mxl_file>
"""
import sys
import music21


def debug(file_path: str):
    score = music21.converter.parse(file_path)

    print(f"Parts: {len(score.parts)}")
    for i, part in enumerate(score.parts):
        print(f"\n=== Part {i}: '{part.partName}' ===")

        flat = part.flatten()
        elements = list(flat.notes)[:30]

        print(f"  First {len(elements)} elements from flatten().notes:")
        for j, elem in enumerate(elements):
            etype = type(elem).__name__
            mro = [c.__name__ for c in type(elem).__mro__]

            # Pitch info
            if hasattr(elem, 'pitches'):
                pitches = [str(p) for p in elem.pitches]
                midi_vals = [p.midi for p in elem.pitches]
            elif hasattr(elem, 'pitch'):
                pitches = [str(elem.pitch)]
                midi_vals = [elem.pitch.midi]
            else:
                pitches = ['N/A']
                midi_vals = ['N/A']

            # Tie info
            tie = getattr(elem, 'tie', None)
            tie_str = f", tie={tie.type}" if tie else ""

            # Grace note info
            dur_type = elem.duration.type
            is_grace = isinstance(elem.duration, music21.duration.GraceDuration)
            grace_str = f", GRACE({dur_type})" if is_grace else ""

            # Check if ChordSymbol
            is_cs = isinstance(elem, music21.harmony.ChordSymbol)
            cs_str = ", CHORDSYMBOL" if is_cs else ""

            print(f"  [{j:2d}] {etype:15s} offset={elem.offset:<8} ql={elem.quarterLength:<6} "
                  f"pitch={pitches} midi={midi_vals}{tie_str}{grace_str}{cs_str}")
            if j < 5:
                print(f"       MRO: {' -> '.join(mro[:6])}")

        # Also show what stripTies produces
        stripped = list(flat.stripTies().notes)[:30]
        print(f"\n  First {len(stripped)} elements from flatten().stripTies().notes:")
        for j, elem in enumerate(stripped):
            etype = type(elem).__name__
            if hasattr(elem, 'pitches'):
                pitches = [str(p) for p in elem.pitches]
                midi_vals = [p.midi for p in elem.pitches]
            elif hasattr(elem, 'pitch'):
                pitches = [str(elem.pitch)]
                midi_vals = [elem.pitch.midi]
            else:
                pitches = ['N/A']
                midi_vals = ['N/A']

            is_grace = isinstance(elem.duration, music21.duration.GraceDuration)
            grace_str = f", GRACE" if is_grace else ""
            is_cs = isinstance(elem, music21.harmony.ChordSymbol)
            cs_str = ", CHORDSYMBOL" if is_cs else ""

            print(f"  [{j:2d}] {etype:15s} offset={elem.offset:<8} ql={elem.quarterLength:<6} "
                  f"pitch={pitches} midi={midi_vals}{grace_str}{cs_str}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_musicxml.py <file.mxl>")
        sys.exit(1)
    debug(sys.argv[1])
