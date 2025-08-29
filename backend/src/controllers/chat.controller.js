import { generateStreamToken } from "../config/stream.js";

export const getStreamToken = async (req, res) => {
  try {
    // Call req.auth() to get the auth object
    const auth = req.auth?.();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - no userId" });
    }

    const token = generateStreamToken(userId);
    res.json({ token });
  } catch (error) {
    console.error("Error generating Stream token:", error);
    res.status(500).json({ error: "Failed to generate Stream token" });
  }
};
