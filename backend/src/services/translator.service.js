// backend/src/services/translator.service.js
import { ENV } from "../config/env.js";

/**
 * Free Google Translate API (gtx client) - matches Cicada's built-in GoogleTranslator
 */
export async function translateTextGoogle(text, targetLang = "en", sourceLang = "auto") {
  if (!text || !text.trim()) return "";
  
  // Map common language codes
  const langMap = {
    en: "en",
    zh: "zh-CN",
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    es: "es",
    ja: "ja",
    ko: "ko",
    fr: "fr",
    de: "de",
    hi: "hi",
    ru: "ru",
    pt: "pt",
    it: "it",
    ar: "ar",
  };

  const target = langMap[targetLang] || targetLang;
  const source = sourceLang === "auto" ? "auto" : (langMap[sourceLang] || sourceLang);

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    source
  )}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Cicada/1.1 (Qubit-Video)",
      },
    });

    if (!res.ok) {
      throw new Error(`Google Translate returned status: ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
        .join("");
      return translated || text;
    }
    return text;
  } catch (err) {
    console.error("Google translate error:", err.message);
    return text;
  }
}

/**
 * Translate using OpenAI if configured
 */
export async function translateTextOpenAI(text, targetLang = "English") {
  if (!ENV.OPENAI_API_KEY) return null;

  try {
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert real-time simultaneous interpreter. Translate the user speech into ${targetLang}. Return ONLY the direct translation without explanation or quotes.`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content?.trim();
  } catch (err) {
    console.warn("OpenAI translation failed:", err.message);
    return null;
  }
}

/**
 * Universal text translation with cascading fallbacks
 */
export async function translateText(text, targetLang = "en", sourceLang = "auto") {
  if (!text || !text.trim()) return "";
  
  // Try Google Translate first (instant, free, reliable)
  try {
    const result = await translateTextGoogle(text, targetLang, sourceLang);
    if (result && result.trim()) return result;
  } catch (e) {
    console.warn("Google translate fallback error:", e);
  }

  // Fallback to OpenAI if available
  if (ENV.OPENAI_API_KEY) {
    const aiResult = await translateTextOpenAI(text, targetLang);
    if (aiResult) return aiResult;
  }

  return text;
}
