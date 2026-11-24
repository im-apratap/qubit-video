// backend/src/services/notes.service.js
import { ENV } from "../config/env.js";

/**
 * Helper to format seconds into mm:ss
 */
export function formatClock(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/**
 * Generate meeting notes using OpenAI if API key exists
 */
async function generateWithOpenAI({ transcript, language = "English", currentNotes = {}, isFinal = false }) {
  if (!ENV.OPENAI_API_KEY) return null;

  try {
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

    const formattedLines = transcript
      .map((l, idx) => `[L${idx + 1} ${formatClock(l.t || idx * 10)} ${l.speaker || "Speaker"}] ${l.text || l.shown || ""}`)
      .join("\n");

    const systemPrompt = `You are Cicada (知了), an expert AI meeting scribe. Your task is to extract structured, actionable meeting minutes and notes from a bilingual conversation transcript.
You must return ONLY a valid JSON object matching the exact specification below without any Markdown wrapper or backticks.

Specification:
{
  "title": "short concise meeting title (max 6 words or 12 Chinese chars)",
  "summary": "2-3 clear sentences summarizing the entire meeting progress so far",
  "topics": [
    {
      "start": 0,
      "title": "Topic Title",
      "summary": "one sentence on the whole topic",
      "points": [
        { "text": "key discussion point", "evidence": ["L1"] }
      ],
      "fishbone": null or {
        "question": "The central problem or causal question discussed",
        "branches": [
          { "label": "Key Factor", "detail": "explanation of factor", "t": 0, "evidence": ["L2"] }
        ]
      }
    }
  ],
  "conclusions": [
    { "text": "decision or conclusion reached", "owner": null, "support": 1, "t": 0, "evidence": ["L3"] }
  ],
  "todos": [
    { "text": "action item to be completed", "owner": "You / Them / Name", "support": 1, "t": 0, "evidence": ["L4"] }
  ],
  "terms": [
    { "name": "Proper Term / Name", "note": "brief definition or role", "heard": ["misheard variant"] }
  ]
}

Rules:
- Write the notes in ${language}.
- Only include fishbone when a topic specifically examines root causes, bottlenecks, or reasons for a problem (3-4 branches).
- Attribute every point, conclusion, and todo to transcript evidence [L1, L2, etc.].
- Distinguish between decisions (conclusions) and action items (todos).
- Output raw JSON only.`;

    const userPrompt = `Transcript (${transcript.length} lines, ${isFinal ? "Meeting Ended - Final Review" : "Meeting In Progress - Live Update"}):
${formattedLines}

${currentNotes && currentNotes.summary ? `Previous Notes Context:\n${JSON.stringify(currentNotes)}\n` : ""}

Generate the structured meeting notes now.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        ...parsed,
        covered: transcript.length,
        final: isFinal,
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("OpenAI meeting notes generation failed:", err.message);
  }

  return null;
}

/**
 * Intelligent local fallback summarizer and structured analyzer
 */
function generateLocally({ transcript, language = "English", isFinal = false }) {
  if (!transcript || transcript.length === 0) {
    return {
      title: "New Meeting",
      summary: "Meeting just started. Speak to begin automatic transcription and live notes.",
      topics: [],
      conclusions: [],
      todos: [],
      terms: [],
      covered: 0,
      final: isFinal,
      updatedAt: new Date().toISOString(),
    };
  }

  const lines = transcript;
  const total = lines.length;

  // Extract candidate decisions / conclusions
  const conclusionKeywords = [
    "agree", "agreed", "decided", "conclude", "settled", "resolved", "confirmed", "finalized",
    "决定", "确认", "达成一致", "同意", "定下来", "结论", "确定"
  ];

  // Extract candidate todos / action items
  const todoKeywords = [
    "will", "need to", "must", "todo", "to-do", "action item", "follow up", "assign", "prepare", "send", "review",
    "schedule", "handle", "check", "待办", "负责", "安排", "准备", "跟进", "需要", "发一下", "记得"
  ];

  // Extract problem / causal indicators for fishbone
  const causeKeywords = [
    "problem", "issue", "bug", "delay", "cause", "because", "due to", "reason", "failure", "risk", "challenge",
    "问题", "原因", "导致", "因为", "故障", "难点", "瓶颈", "风险"
  ];

  const conclusions = [];
  const todos = [];
  const causalSentences = [];

  lines.forEach((l, idx) => {
    const text = (l.text || l.shown || "").trim();
    if (!text) return;

    const lower = text.toLowerCase();
    const lineRef = `L${idx + 1}`;
    const timeSec = l.t || idx * 10;
    const speaker = l.speaker || (idx % 2 === 0 ? "You" : "Them");

    // Check decisions
    if (conclusionKeywords.some((k) => lower.includes(k))) {
      conclusions.push({
        text,
        support: 1,
        t: timeSec,
        evidence: [lineRef],
      });
    }

    // Check todos
    if (todoKeywords.some((k) => lower.includes(k))) {
      let owner = speaker;
      if (lower.includes("i will") || lower.includes("i'll") || lower.includes("我来") || lower.includes("我会")) {
        owner = "You";
      } else if (lower.includes("you can") || lower.includes("you should") || lower.includes("你来") || lower.includes("请你")) {
        owner = "Them";
      }

      todos.push({
        text,
        owner,
        support: 1,
        t: timeSec,
        evidence: [lineRef],
      });
    }

    // Check causal / fishbone candidate
    if (causeKeywords.some((k) => lower.includes(k))) {
      causalSentences.push({ text, lineRef, timeSec });
    }
  });

  // Group topics into logical chunks (e.g. 4-6 lines per topic)
  const chunkSize = Math.max(3, Math.min(6, Math.ceil(total / 3)));
  const topics = [];

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    const startSec = chunk[0].t || i * 10;
    const firstLineText = (chunk[0].text || "").slice(0, 40);

    const points = chunk.slice(0, 4).map((item, pIdx) => ({
      text: item.text || item.shown || "Discussion item",
      evidence: [`L${i + pIdx + 1}`],
    }));

    // Fishbone diagram generation if causal discussion exists
    let fishbone = null;
    if (causalSentences.length > 0 && topics.length === 0) {
      fishbone = {
        question: "Key Factors & Root Causes Identified",
        branches: causalSentences.slice(0, 4).map((cs, bIdx) => ({
          label: `Factor ${bIdx + 1}: ${cs.text.split(/[.,!?。！？]/)[0].slice(0, 25)}`,
          detail: cs.text,
          t: cs.timeSec,
          evidence: [cs.lineRef],
        })),
      };
    }

    topics.push({
      start: startSec,
      title: topics.length === 0 ? "Opening & Overview" : `Topic ${topics.length + 1}: ${firstLineText || "Discussion"}`,
      summary: chunk.map((c) => c.text).filter(Boolean).slice(0, 2).join(". ") || "Discussion underway.",
      points,
      fishbone,
    });
  }

  // Derive title & summary
  const sampleText = lines.slice(0, 3).map((l) => l.text).join(" ");
  const title = sampleText
    ? sampleText.split(/[.,!?。！？]/)[0].slice(0, 35)
    : "Live Conference Call";

  const summary = `The meeting covered ${total} discussion segments across ${topics.length} topic${topics.length > 1 ? "s" : ""}. Key items discussed include ${
    topics[0]?.title || "initial agenda"
  }${conclusions.length > 0 ? `, reaching ${conclusions.length} conclusion(s)` : ""}${
    todos.length > 0 ? ` and assigning ${todos.length} action item(s)` : ""
  }.`;

  // Extract terms / entities
  const terms = [];
  const words = lines.flatMap((l) => (l.text || "").split(/\s+/));
  const capitalized = [...new Set(words.filter((w) => /^[A-Z][a-zA-Z0-9_-]{2,}$/.test(w)))];
  capitalized.slice(0, 6).forEach((term) => {
    terms.push({
      name: term,
      note: "Key Term or Entity",
      heard: [],
    });
  });

  return {
    title,
    summary,
    topics,
    conclusions: conclusions.slice(0, 5),
    todos: todos.slice(0, 6),
    terms,
    covered: total,
    final: isFinal,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Main export: Generate or update meeting notes
 */
export async function generateMeetingNotes({ transcript, language = "English", currentNotes = {}, isFinal = false }) {
  // 1. Try OpenAI if configured
  const aiResult = await generateWithOpenAI({ transcript, language, currentNotes, isFinal });
  if (aiResult) return aiResult;

  // 2. Intelligent local analyzer
  return generateLocally({ transcript, language, isFinal });
}
