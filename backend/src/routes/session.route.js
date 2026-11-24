// backend/src/routes/session.route.js
import express from "express";
import {
  getSessions,
  getSessionById,
  saveSession,
  deleteSession,
} from "../controllers/session.controller.js";

const router = express.Router();

router.get("/", getSessions);
router.get("/:id", getSessionById);
router.post("/", saveSession);
router.delete("/:id", deleteSession);

export default router;
