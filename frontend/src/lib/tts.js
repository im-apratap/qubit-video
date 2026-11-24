import { axiosInstance } from "./axios";

/**
 * Synthesizes speech from text via backend Nari Labs proxy with Web Speech fallback.
 */
export async function speakText({ text, voice = "diana", model = "qwen3-tts:free", lang = "en" }) {
  if (!text || !text.trim()) return null;

  // 1. Try Nari Labs TTS via backend proxy
  try {
    const response = await axiosInstance.post(
      "/speech",
      { input: text, voice, model, response_format: "wav" },
      { responseType: "blob", timeout: 8000 }
    );

    if (response.data instanceof Blob && !response.data.type.includes("json")) {
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
      return audio;
    }
  } catch (err) {
    console.warn("Backend Nari TTS unavailable, falling back to Web Speech API:", err.message);
  }

  // 2. Fallback to browser SpeechSynthesis (Web Speech API)
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select appropriate language if available
    if (lang) utterance.lang = lang;
    
    // Select voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const match = voices.find((v) => 
        (voice === "leon" ? v.name.toLowerCase().includes("male") : v.name.toLowerCase().includes("female")) ||
        (lang && v.lang.startsWith(lang.slice(0, 2)))
      );
      if (match) utterance.voice = match;
    }

    utterance.rate = 1.0;
    utterance.pitch = voice === "diana" ? 1.05 : 0.95;
    window.speechSynthesis.speak(utterance);

    return {
      pause: () => window.speechSynthesis.cancel(),
      play: () => window.speechSynthesis.speak(utterance),
    };
  }

  return null;
}
