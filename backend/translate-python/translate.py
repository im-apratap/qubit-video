# translate.py
import whisper
import tempfile
import os
import base64
from flask import Flask, request, jsonify

# Initialize the Whisper model
print("Loading Whisper model... (this may take a minute)")
model = whisper.load_model("medium")
print("Whisper model loaded.")

app = Flask(__name__)

@app.route('/translate', methods=['POST'])
def translate_audio():
    try:
        # Get JSON data from the request
        data = request.get_json()
        audio_data_base64 = data["audio"]["data"]
        audio_data = base64.b64decode(audio_data_base64)
        call_id = data.get("callId", "test-call-id")
        user_id = data.get("userId", "test-user-id")

        # Create a temporary file for the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_audio:
            tmp_audio.write(audio_data)
            tmp_audio_path = tmp_audio.name

        # Transcribe and translate
        result = model.transcribe(tmp_audio_path, task="translate")
        translated_text = result["text"]
        print(f"Translated: {translated_text}")

        # Clean up
        os.unlink(tmp_audio_path)

        return jsonify({
            "success": True,
            "translatedText": translated_text,
            "callId": call_id,
            "userId": user_id
        })

    except Exception as e:
        print(f"Error during translation: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    print("Starting Python translation server on port 8001...")
    app.run(port=8001, debug=True)