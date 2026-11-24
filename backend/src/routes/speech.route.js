import express from "express";
import { generateSpeech } from "../controllers/speech.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protectRoute, generateSpeech);

export default router;
