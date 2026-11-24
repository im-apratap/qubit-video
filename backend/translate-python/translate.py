# translate.py
import whisper
import tempfile
import os
import base64
from flask import Flask, request, jsonify

# Load Whisper model (defaults to base for fast startup, configurable via WHISPER_MODEL)
model_name = os.environ.get("WHISPER_MODEL", "base")
print(f"Loading Whisper model '{model_name}'...")
try:
    model = whisper.load_model(model_name)
    print("Whisper model loaded successfully.")
except Exception as e:
    print(f"Failed to load '{model_name}', falling back to 'tiny': {e}")
    model = whisper.load_model("tiny")

app = Flask(__name__)

@app.route('/translate', methods=['POST'])
def translate_audio():
    tmp_audio_path = None
    try:
        data = request.get_json() or {}
        audio_data_base64 = data.get("audio", {}).get("data", "")
        if not audio_data_base64:
            return jsonify({"success": False, "error": "No audio payload provided"}), 400

        audio_data = base64.b64decode(audio_data_base64)
        call_id = data.get("callId", "default-call")
        user_id = data.get("userId", "default-user")
        target_lang = data.get("targetLang", "en")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_audio:
            tmp_audio.write(audio_data)
            tmp_audio_path = tmp_audio.name

        # 1. Transcribe original spoken text
        transcribe_result = model.transcribe(tmp_audio_path, task="transcribe")
        source_text = transcribe_result.get("text", "").strip()
        detected_lang = transcribe_result.get("language", "auto")

        # 2. Translate if needed
        translate_result = model.transcribe(tmp_audio_path, task="translate")
        translated_text = translate_result.get("text", "").strip()

        print(f"[{detected_lang}] Source: {source_text} -> Translated: {translated_text}")

        return jsonify({
            "success": True,
            "sourceText": source_text,
            "translatedText": translated_text or source_text,
            "detectedLang": detected_lang,
            "targetLang": target_lang,
            "callId": call_id,
            "userId": user_id
        })

    except Exception as e:
        print(f"Error during audio processing: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if tmp_audio_path and os.path.exists(tmp_audio_path):
            try:
                os.unlink(tmp_audio_path)
            except Exception:
                pass

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "model": model_name})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    print(f"Starting Python Whisper translation server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)