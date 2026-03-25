import os
import tempfile

from flask import Flask, request, jsonify
from flask_cors import CORS

from midi_parser import parse_midi
from musicxml_parser import parse_musicxml

MIDI_EXTENSIONS = (".mid", ".midi")
MUSICXML_EXTENSIONS = (".musicxml", ".mxl", ".xml")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB max upload
CORS(app)


@app.route("/api/parse", methods=["POST"])
def parse():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename provided"}), 400

    filename_lower = file.filename.lower()
    is_midi = filename_lower.endswith(MIDI_EXTENSIONS)
    is_musicxml = filename_lower.endswith(MUSICXML_EXTENSIONS)

    if not is_midi and not is_musicxml:
        return jsonify({"error": "File must be a MIDI (.mid, .midi) or MusicXML (.musicxml, .mxl, .xml) file"}), 400

    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        if is_musicxml:
            result = parse_musicxml(tmp_path)
        else:
            result = parse_midi(tmp_path)
        return jsonify(result)
    except Exception as e:
        fmt = "MusicXML" if is_musicxml else "MIDI"
        return jsonify({"error": f"Failed to parse {fmt} file: {str(e)}"}), 400
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
