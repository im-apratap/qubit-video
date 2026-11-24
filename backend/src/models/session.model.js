// backend/src/models/session.model.js
import mongoose from "mongoose";

const transcriptLineSchema = new mongoose.Schema(
  {
    id: { type: String },
    t: { type: Number, default: 0 },
    speaker: { type: String, default: "Speaker" },
    text: { type: String, required: true },
    translation: { type: String, default: "" },
    lang: { type: String, default: "auto" },
    targetLang: { type: String, default: "en" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    callId: { type: String, required: true, index: true },
    title: { type: String, default: "Untitled Meeting" },
    userId: { type: String },
    participants: [{ type: String }],
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 },
    transcript: [transcriptLineSchema],
    notes: { type: mongoose.Schema.Types.Mixed, default: {} },
    vocabulary: [{ type: String }],
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", sessionSchema);
