// routes/translation.js
import express from "express";
import multer from "multer";
import { translateText } from "../services/translator.service.js";
import { ENV } from "../config/env.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Speaker voice for Nari TTS playback of the translation ("diana" or "leon").
const VALID_VOICES = new Set(["diana", "leon"]);

/**
 * Text translation endpoint (Cicada real-time subtitle translation)
 */
router.post("/text", async (req, res) => {
  try {
    const { text, targetLang = "en", sourceLang = "auto" } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const translatedText = await translateText(text, targetLang, sourceLang);
    res.status(200).json({
      success: true,
      originalText: text,
      translation: translatedText,
      targetLang,
    });
  } catch (error) {
    console.error("Text translation error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Audio translation endpoint (Whisper speech-to-text + translation)
 */
router.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    // Get callId, userId, voice and targetLang from request body
    const { callId, userId, voice, targetLang = "en", speakerName = "You" } = req.body;

    let sourceText = "";
    let translatedText = "";

    // 1. Try Python Whisper service if active
    let pythonSuccess = false;
    try {
      const pythonResponse = await fetch("http://localhost:8001/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio: {
            data: req.file.buffer.toString("base64"),
          },
          callId: callId || "test-call-id",
          userId: userId || "test-user-id",
          targetLang: targetLang || "en",
        }),
      });

      if (pythonResponse.ok) {
        const result = await pythonResponse.json();
        if (result.success) {
          pythonSuccess = true;
          sourceText = result.sourceText || result.translatedText;
          translatedText = result.translatedText;
        }
      }
    } catch (pyErr) {
      // Python server not running, continue to OpenAI / fallback
    }

    // 2. If Python server didn't handle it, try OpenAI Whisper if API key is set
    if (!pythonSuccess && ENV.OPENAI_API_KEY) {
      try {
        const { OpenAI, toFile } = await import("openai");
        const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
        const file = await toFile(req.file.buffer, "speech.webm", { type: "audio/webm" });

        const transcription = await openai.audio.transcriptions.create({
          file,
          model: "whisper-1",
        });

        sourceText = transcription.text;
        translatedText = await translateText(sourceText, targetLang);
        pythonSuccess = true;
      } catch (aiErr) {
        console.warn("OpenAI Whisper transcription failed:", aiErr.message);
      }
    }

    // 3. Fallback: If neither was available
    if (!pythonSuccess) {
      return res.status(503).json({
        error: "Translation service unavailable. Please ensure the Python Whisper server (port 8001) is running or OPENAI_API_KEY is configured.",
      });
    }

    // Translate source text into requested target language if target differs
    if (targetLang && targetLang !== "en" && sourceText) {
      translatedText = await translateText(sourceText, targetLang);
    }

    res.status(200).json({
      success: true,
      originalText: sourceText,
      translation: translatedText,
      speaker: speakerName,
      targetLang,
      voice: VALID_VOICES.has(voice) ? voice : "diana",
    });
  } catch (error) {
    console.error("Translation route error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
