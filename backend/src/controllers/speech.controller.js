import { ENV } from "../config/env.js";

const NARI_TTS_URL = "https://api.narilabs.com/v1/audio/speech";

// Valid per docs.narilabs.com/generate-speech: model, voice are required and
// case-sensitive; response_format is "wav" (default) or "pcm"; text is 1–2048
// code points; unknown/null fields are rejected with 400 by the API.
export const generateSpeech = async (req, res) => {
  try {
    const { model, voice, input, language, response_format, seed } = req.body ?? {};

    if (!model || typeof model !== "string") {
      return res.status(400).json({ error: "Missing required field: model" });
    }
    if (!voice || typeof voice !== "string") {
      return res.status(400).json({ error: "Missing required field: voice" });
    }
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Missing required field: input" });
    }
    if (input.trim().length < 1 || input.trim().length > 2048) {
      return res
        .status(400)
        .json({ error: "input must be 1–2048 characters after trimming" });
    }

    const nariResponse = await fetch(NARI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.NARI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model, // e.g. "qwen3-tts:free"
        voice, // e.g. "diana" | "leon"
        input,
        ...(language && language !== "auto" ? { language } : {}),
        response_format: response_format || "wav",
        ...(typeof seed === "number" ? { seed } : {}),
      }),
    });

    if (!nariResponse.ok) {
      let message = `Nari Labs API error (${nariResponse.status})`;
      try {
        const errBody = await nariResponse.json();
        if (errBody?.error?.message) message = errBody.error.message;
        else if (typeof errBody?.error === "string") message = errBody.error;
      } catch {
        /* body was not JSON */
      }
      console.error("Nari TTS request failed:", nariResponse.status, message);
      return res.status(nariResponse.status).json({ error: message });
    }

    // Success: HTTP 200 with binary audio (audio/wav or audio/pcm).
    res.setHeader(
      "Content-Type",
      nariResponse.headers.get("content-type") || "audio/wav"
    );
    const seedUsed = nariResponse.headers.get("x-nari-seed");
    if (seedUsed) res.setHeader("X-Nari-Seed", seedUsed);
    res.setHeader("Cache-Control", "no-store");

    const arrayBuffer = await nariResponse.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Speech controller error:", error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
};
