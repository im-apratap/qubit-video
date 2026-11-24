// backend/src/routes/notes.route.js
import express from "express";
import { generateNotes } from "../controllers/notes.controller.js";

const router = express.Router();

router.post("/generate", generateNotes);

export default router;
