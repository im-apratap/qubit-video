// backend/src/routes/vocabulary.route.js
import express from "express";

const router = express.Router();

// In-memory word list store
let vocabularyStore = [
  { id: "1", word: "Qubit", note: "Video conferencing platform", homophones: ["cue bit", "cubic"] },
  { id: "2", word: "Cicada", note: "AI Meeting notes & subtitles (知了)", homophones: ["see car da", "circada"] },
  { id: "3", word: "WebRTC", note: "Real-time communication protocol", homophones: ["web rtc", "web RTC"] },
];

router.get("/", (req, res) => {
  res.status(200).json({ success: true, vocabulary: vocabularyStore });
});

router.post("/", (req, res) => {
  const { word, note, homophones = [] } = req.body;
  if (!word || !word.trim()) {
    return res.status(400).json({ error: "Word is required" });
  }

  const existingIndex = vocabularyStore.findIndex(
    (item) => item.word.toLowerCase() === word.trim().toLowerCase()
  );

  const entry = {
    id: existingIndex >= 0 ? vocabularyStore[existingIndex].id : String(Date.now()),
    word: word.trim(),
    note: note || "",
    homophones: Array.isArray(homophones) ? homophones : [],
  };

  if (existingIndex >= 0) {
    vocabularyStore[existingIndex] = entry;
  } else {
    vocabularyStore.push(entry);
  }

  res.status(200).json({ success: true, vocabulary: vocabularyStore });
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  vocabularyStore = vocabularyStore.filter((item) => item.id !== id && item.word !== id);
  res.status(200).json({ success: true, vocabulary: vocabularyStore });
});

export default router;
