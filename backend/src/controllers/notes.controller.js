// backend/src/controllers/notes.controller.js
import { generateMeetingNotes } from "../services/notes.service.js";

export const generateNotes = async (req, res) => {
  try {
    const { transcript = [], language = "English", currentNotes = {}, isFinal = false } = req.body;

    if (!Array.isArray(transcript)) {
      return res.status(400).json({ error: "transcript must be an array" });
    }

    const notes = await generateMeetingNotes({
      transcript,
      language,
      currentNotes,
      isFinal: !!isFinal,
    });

    res.status(200).json({
      success: true,
      notes,
    });
  } catch (error) {
    console.error("Notes generation controller error:", error);
    res.status(500).json({ error: error.message || "Failed to generate meeting notes" });
  }
};
