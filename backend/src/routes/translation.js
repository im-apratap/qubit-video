// routes/translation.js
import express from "express";
import multer from "multer";
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    // Get callId and userId from request body
    const { callId, userId } = req.body;

    // Send the audio to the Python HTTP server
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
      }),
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python server error: ${pythonResponse.status}`);
    }

    const result = await pythonResponse.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    // Send the translated text back to the frontend
    res.status(200).json({
      translation: result.translatedText,
    });
  } catch (error) {
    console.error("Translation route error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
