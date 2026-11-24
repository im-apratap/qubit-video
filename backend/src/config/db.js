import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  if (!ENV.MONGO_URI) {
    console.warn("MongoDB URI not provided. Running with in-memory session storage fallback.");
    return;
  }
  try {
    const conn = await mongoose.connect(ENV.MONGO_URI);
    console.log("MongoDB connected successfully:", conn.connection.host);
  } catch (error) {
    console.warn("MongoDB connection failed:", error.message);
    console.warn("Continuing with in-memory session storage fallback.");
  }
};