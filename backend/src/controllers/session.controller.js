// backend/src/controllers/session.controller.js
import { Session } from "../models/session.model.js";
import mongoose from "mongoose";

// In-memory fallback cache when MongoDB is offline
const memorySessions = new Map();

const isDbConnected = () => mongoose.connection.readyState === 1;

export const getSessions = async (req, res) => {
  try {
    if (isDbConnected()) {
      const sessions = await Session.find().sort({ createdAt: -1 }).limit(50);
      return res.status(200).json({ success: true, sessions });
    }

    // Fallback
    const sessions = Array.from(memorySessions.values()).sort(
      (a, b) => new Date(b.createdAt || b.startedAt) - new Date(a.createdAt || a.startedAt)
    );
    return res.status(200).json({ success: true, sessions });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      let session = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        session = await Session.findById(id);
      }
      if (!session) {
        session = await Session.findOne({ callId: id });
      }

      if (session) {
        return res.status(200).json({ success: true, session });
      }
    }

    // Fallback
    const session = memorySessions.get(id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(200).json({ success: true, session });
  } catch (error) {
    console.error("Get session by id error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const saveSession = async (req, res) => {
  try {
    const {
      callId,
      title,
      userId,
      participants = [],
      startedAt = new Date(),
      endedAt = new Date(),
      duration = 0,
      transcript = [],
      notes = {},
      vocabulary = [],
    } = req.body;

    if (!callId) {
      return res.status(400).json({ error: "callId is required" });
    }

    const sessionData = {
      callId,
      title: title || `Meeting ${callId}`,
      userId,
      participants,
      startedAt,
      endedAt,
      duration,
      transcript,
      notes,
      vocabulary,
      updatedAt: new Date(),
    };

    if (isDbConnected()) {
      const updated = await Session.findOneAndUpdate(
        { callId },
        { $set: sessionData },
        { upsert: true, new: true }
      );
      return res.status(200).json({ success: true, session: updated });
    }

    // Fallback
    const existing = memorySessions.get(callId) || {};
    const saved = {
      _id: existing._id || `mem_${Date.now()}`,
      createdAt: existing.createdAt || new Date(),
      ...sessionData,
    };
    memorySessions.set(callId, saved);

    return res.status(200).json({ success: true, session: saved });
  } catch (error) {
    console.error("Save session error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        await Session.findByIdAndDelete(id);
      } else {
        await Session.findOneAndDelete({ callId: id });
      }
    }

    memorySessions.delete(id);
    res.status(200).json({ success: true, message: "Session deleted" });
  } catch (error) {
    console.error("Delete session error:", error);
    res.status(500).json({ error: error.message });
  }
};
