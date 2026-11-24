import React, { useState, useMemo, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  X,
  Copy,
  Download,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  ListTodo,
  BookOpen,
  Volume2,
  RefreshCw,
  Languages,
  ChevronRight,
  Plus,
  Trash2,
  Layers,
  Settings,
  Share2,
} from "lucide-react";
import CicadaFishbone from "./CicadaFishbone";
import { SUPPORTED_LANGUAGES } from "./CicadaSubtitleBar";

/**
 * Format seconds to mm:ss
 */
function formatTime(sec) {
  if (sec == null) return "00:00";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/**
 * Download a file in browser
 */
function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Format SRT Subtitles
 */
function generateSrt(transcript) {
  if (!transcript || transcript.length === 0) return "";
  return transcript
    .map((item, index) => {
      const startSec = item.t || index * 5;
      const endSec = startSec + 4;
      const formatSrtTime = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
          s
        ).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };

      return `${index + 1}\n${formatSrtTime(startSec)} --> ${formatSrtTime(
        endSec
      )}\n${item.speaker ? item.speaker + ": " : ""}${item.text || ""}\n${
        item.translation || ""
      }\n`;
    })
    .join("\n");
}

/**
 * Format clean Markdown for export or copy
 */
function generateMarkdownNotes(notes, transcript, callId) {
  let md = `# Meeting Notes · ${notes?.title || `Call ${callId || ""}`}\n\n`;
  md += `**Date:** ${new Date().toLocaleString()}\n`;
  md += `**Status:** ${notes?.final ? "Finalized (完整版)" : "Live (速记版)"}\n\n`;

  if (notes?.summary) {
    md += `## Summary (总结)\n${notes.summary}\n\n`;
  }

  if (notes?.topics && notes.topics.length > 0) {
    md += `## Topics (议题与要点)\n`;
    notes.topics.forEach((t) => {
      md += `### [${formatTime(t.start)}] ${t.title}\n`;
      if (t.summary) md += `*${t.summary}*\n\n`;
      if (t.points) {
        t.points.forEach((p) => {
          const text = typeof p === "string" ? p : p.text;
          const ev = p.evidence ? ` *(${p.evidence.join(", ")})*` : "";
          md += `- ${text}${ev}\n`;
        });
      }
      if (t.fishbone) {
        md += `\n**Cause & Effect (${t.fishbone.question}):**\n`;
        t.fishbone.branches.forEach((b) => {
          md += `  - **${b.label}:** ${b.detail}\n`;
        });
      }
      md += `\n`;
    });
  }

  if (notes?.conclusions && notes.conclusions.length > 0) {
    md += `## Conclusions (结论)\n`;
    notes.conclusions.forEach((c) => {
      const ev = c.evidence ? ` *(${c.evidence.join(", ")})*` : "";
      md += `- ${c.text}${ev}\n`;
    });
    md += `\n`;
  }

  if (notes?.todos && notes.todos.length > 0) {
    md += `## Action Items & To-dos (待办事项)\n`;
    notes.todos.forEach((td) => {
      const owner = td.owner ? ` **[${td.owner}]**` : "";
      const ev = td.evidence ? ` *(${td.evidence.join(", ")})*` : "";
      md += `- [ ] ${td.text}${owner}${ev}\n`;
    });
    md += `\n`;
  }

  if (notes?.terms && notes.terms.length > 0) {
    md += `## Terminology & Glossary (人名与术语)\n`;
    notes.terms.forEach((tm) => {
      const heard = tm.heard?.length ? ` (heard as: ${tm.heard.join(", ")})` : "";
      md += `- **${tm.name}**: ${tm.note}${heard}\n`;
    });
    md += `\n`;
  }

  return md;
}

/**
 * Cicada AI Live Meeting Notes Drawer
 */
const CicadaNotesDrawer = ({
  isOpen,
  onClose,
  callId,
  notes,
  transcript = [],
  isUpdatingNotes,
  onUpdateNotes,
  onGenerateFinalNotes,
  onReplayLine,
  targetLang,
  onTargetLangChange,
  vocabulary = [],
  onAddVocabulary,
  onDeleteVocabulary,
}) => {
  const [activeTab, setActiveTab] = useState("notes"); // "notes" | "transcript" | "settings"
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedLineId, setHighlightedLineId] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newNote, setNewNote] = useState("");

  const transcriptEndRef = useRef(null);

  // Jump to transcript line and pulse highlight
  const handleJumpToTime = (timeSec) => {
    setActiveTab("transcript");
    // Find closest transcript line
    const match = transcript.find(
      (l) => Math.abs((l.t || 0) - timeSec) < 4 || (l.t || 0) >= timeSec
    );
    if (match) {
      setHighlightedLineId(match.id);
      setTimeout(() => {
        const el = document.getElementById(`line-${match.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      setTimeout(() => setHighlightedLineId(null), 3500);
    }
  };

  const handleJumpToEvidence = (evidenceTag) => {
    // e.g. "L3"
    const lineNum = parseInt(evidenceTag.replace(/[^0-9]/g, ""), 10);
    if (lineNum && transcript[lineNum - 1]) {
      const match = transcript[lineNum - 1];
      setActiveTab("transcript");
      setHighlightedLineId(match.id);
      setTimeout(() => {
        const el = document.getElementById(`line-${match.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      setTimeout(() => setHighlightedLineId(null), 3500);
    }
  };

  // One-click Copy Notes for Notion / Slack / Docs
  const handleCopyNotes = () => {
    const md = generateMarkdownNotes(notes, transcript, callId);
    navigator.clipboard.writeText(md);
    toast.success("Notes copied to clipboard in Markdown format!");
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const md = generateMarkdownNotes(notes, transcript, callId);
    downloadFile(md, `Cicada-Notes-${callId || "meeting"}.md`, "text/markdown");
    toast.success("Downloaded meeting notes (.md)");
    setShowExportMenu(false);
  };

  const handleExportSrt = () => {
    const srt = generateSrt(transcript);
    downloadFile(srt, `Cicada-Subtitles-${callId || "meeting"}.srt`, "text/plain");
    toast.success("Downloaded bilingual subtitles (.srt)");
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    const json = JSON.stringify({ callId, notes, transcript, vocabulary }, null, 2);
    downloadFile(json, `Cicada-Session-${callId || "meeting"}.json`, "application/json");
    toast.success("Downloaded session JSON");
    setShowExportMenu(false);
  };

  // Filter transcript lines based on search
  const filteredTranscript = useMemo(() => {
    if (!searchQuery.trim()) return transcript;
    const q = searchQuery.toLowerCase();
    return transcript.filter(
      (l) =>
        (l.text && l.text.toLowerCase().includes(q)) ||
        (l.translation && l.translation.toLowerCase().includes(q)) ||
        (l.speaker && l.speaker.toLowerCase().includes(q))
    );
  }, [transcript, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-full sm:w-[480px] md:w-[520px] bg-white shadow-2xl border-l border-neutral-200 z-50 flex flex-col font-sans transition-all">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-neutral-50/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#E8552B] flex items-center justify-center text-white shadow-xs">
            <span className="font-bold text-xs">知</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-900 text-sm">
                Cicada · 知了会议
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  notes?.final
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-orange-100 text-[#E8552B] border border-orange-200"
                }`}
              >
                {notes?.final ? "完整版 · Final" : "速记版 · Live"}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              {transcript.length} lines recorded · {notes?.topics?.length || 0} topics
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* One-click copy */}
          <button
            onClick={handleCopyNotes}
            title="Copy notes as Markdown"
            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70 transition"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              title="Export Meeting Records"
              className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70 transition"
            >
              <Download className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5 z-50 text-xs">
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-neutral-700 hover:bg-neutral-100 transition text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-[#E8552B]" />
                  <span>Export Markdown (.md)</span>
                </button>
                <button
                  onClick={handleExportSrt}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-neutral-700 hover:bg-neutral-100 transition text-left"
                >
                  <Languages className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export Subtitles (.srt)</span>
                </button>
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-neutral-700 hover:bg-neutral-100 transition text-left"
                >
                  <Share2 className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Export Full JSON</span>
                </button>
              </div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/70 transition ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200 px-4 bg-white text-xs font-medium">
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 transition ${
            activeTab === "notes"
              ? "border-[#E8552B] text-[#E8552B] font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Live Notes (速记)</span>
        </button>
        <button
          onClick={() => setActiveTab("transcript")}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 transition ${
            activeTab === "transcript"
              ? "border-[#E8552B] text-[#E8552B] font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          <span>Bilingual Transcript (双语)</span>
          {transcript.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 text-neutral-600">
              {transcript.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 transition ${
            activeTab === "settings"
              ? "border-[#E8552B] text-[#E8552B] font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Word List (词库)</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics, conclusions, transcript lines... (⌘F)"
          className="w-full text-xs bg-transparent focus:outline-hidden text-neutral-800 placeholder-neutral-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-neutral-400 hover:text-neutral-600 text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================= TAB 1: NOTES ================= */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            {/* Updating banner */}
            {isUpdatingNotes && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200 text-[#E8552B] text-xs animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Cicada is organizing new transcript lines into structured notes…</span>
              </div>
            )}

            {/* Title & Summary Card */}
            {notes?.summary ? (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Summary · 会议总结
                    </span>
                  </div>
                  {notes?.title && (
                    <span className="text-xs font-semibold text-neutral-800">
                      {notes.title}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-800 leading-relaxed font-normal">
                  {notes.summary}
                </p>
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-neutral-50 border border-dashed border-neutral-300">
                <Sparkles className="w-8 h-8 text-[#E8552B] mx-auto mb-2 opacity-80" />
                <h4 className="text-sm font-semibold text-neutral-800">
                  Ready for Live Minutes
                </h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  Speak in the call or click "Update Notes" to generate real-time AI summaries and structured minutes.
                </p>
                <button
                  onClick={onUpdateNotes}
                  disabled={isUpdatingNotes}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8552B] text-white text-xs font-medium shadow-xs hover:bg-[#d64720] transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isUpdatingNotes ? "animate-spin" : ""}`}
                  />
                  <span>Generate Notes</span>
                </button>
              </div>
            )}

            {/* Topics & Key Points */}
            {notes?.topics && notes.topics.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Topics &amp; Key Points · 议题
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {notes.topics.length} topic(s)
                  </span>
                </div>

                {notes.topics.map((topic, tIdx) => (
                  <div
                    key={topic.id || tIdx}
                    className="p-3.5 rounded-2xl border border-neutral-200/90 bg-white shadow-xs space-y-2 hover:border-neutral-300 transition"
                  >
                    {/* Topic Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleJumpToTime(topic.start)}
                          className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#E8552B] hover:underline"
                          title="Jump to topic start"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(topic.start)}</span>
                        </button>
                        <h4 className="text-xs font-bold text-neutral-900">
                          {topic.title}
                        </h4>
                      </div>
                    </div>

                    {/* Topic Summary */}
                    {topic.summary && (
                      <p className="text-xs text-neutral-600 leading-relaxed italic bg-neutral-50/70 p-2 rounded-lg">
                        {topic.summary}
                      </p>
                    )}

                    {/* Bullet Points with evidence links */}
                    {topic.points && topic.points.length > 0 && (
                      <ul className="space-y-1.5 pt-1">
                        {topic.points.map((point, pIdx) => {
                          const text = typeof point === "string" ? point : point.text;
                          const evidence = point.evidence || [];
                          return (
                            <li
                              key={pIdx}
                              className="text-xs text-neutral-700 flex items-start gap-2 leading-snug"
                            >
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E8552B] mt-1.5 shrink-0" />
                              <div className="flex-1">
                                <span>{text}</span>
                                {evidence.length > 0 && (
                                  <span className="inline-flex items-center gap-1 ml-2">
                                    {evidence.map((ev, eIdx) => (
                                      <button
                                        key={eIdx}
                                        onClick={() => handleJumpToEvidence(ev)}
                                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-[#E8552B]/10 hover:text-[#E8552B] text-neutral-500 transition font-medium"
                                        title={`Jump to line ${ev}`}
                                      >
                                        {ev}
                                      </button>
                                    ))}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Fishbone Diagram (if present) */}
                    {topic.fishbone && (
                      <CicadaFishbone
                        fishbone={topic.fishbone}
                        onJump={handleJumpToTime}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Conclusions */}
            {notes?.conclusions && notes.conclusions.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Conclusions &amp; Decisions · 结论
                </span>
                <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden divide-y divide-neutral-100 shadow-xs">
                  {notes.conclusions.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-start gap-2.5 text-xs text-neutral-800 hover:bg-neutral-50/50 transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="leading-snug">{item.text}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {item.t != null && (
                            <button
                              onClick={() => handleJumpToTime(item.t)}
                              className="text-[10px] font-mono text-[#E8552B] hover:underline"
                            >
                              {formatTime(item.t)}
                            </button>
                          )}
                          {item.evidence && (
                            <span className="text-[10px] text-neutral-400 font-mono">
                              Evidence: {item.evidence.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* To-dos / Action Items */}
            {notes?.todos && notes.todos.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Action Items · 待办事项
                </span>
                <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden divide-y divide-neutral-100 shadow-xs">
                  {notes.todos.map((todo, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-start gap-2.5 text-xs text-neutral-800 hover:bg-neutral-50/50 transition"
                    >
                      <ListTodo className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="leading-snug font-medium">{todo.text}</p>
                          {todo.owner && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {todo.owner}
                            </span>
                          )}
                        </div>
                        {todo.evidence && (
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                            <span>Evidence: {todo.evidence.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Terms & Jargon */}
            {notes?.terms && notes.terms.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Glossary &amp; Terms · 人名与术语
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {notes.terms.map((term, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-800"
                    >
                      <span className="font-semibold text-neutral-900">
                        {term.name}
                      </span>
                      {term.note && (
                        <span className="text-[10px] text-neutral-500">
                          ({term.note})
                        </span>
                      )}
                      {term.heard && term.heard.length > 0 && (
                        <span className="text-[10px] text-orange-600 font-mono">
                          fix: {term.heard.join(", ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: BILINGUAL TRANSCRIPT ================= */}
        {activeTab === "transcript" && (
          <div className="space-y-3">
            {filteredTranscript.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-xs">
                No speech recorded yet. Use the microphone or talk key to speak.
              </div>
            ) : (
              filteredTranscript.map((line, idx) => {
                const lineId = line.id || `line-${idx}`;
                const isSelected = highlightedLineId === line.id;
                return (
                  <div
                    id={`line-${line.id}`}
                    key={lineId}
                    className={`p-3 rounded-2xl border transition-all duration-300 ${
                      isSelected
                        ? "bg-orange-50 border-[#E8552B] shadow-md ring-2 ring-[#E8552B]/20"
                        : "bg-white border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    {/* Line Header */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-500">
                          L{idx + 1}
                        </span>
                        <span className="font-mono text-neutral-400">
                          {formatTime(line.t || idx * 8)}
                        </span>
                        <span className="font-semibold text-neutral-700 px-1.5 py-0.5 rounded bg-neutral-100 text-[10px]">
                          {line.speaker || "Speaker"}
                        </span>
                        {line.lang && (
                          <span className="text-[9px] uppercase px-1 rounded bg-neutral-100 text-neutral-500 font-mono">
                            {line.lang}
                          </span>
                        )}
                      </div>

                      {/* Line TTS replay button */}
                      {line.translation && onReplayLine && (
                        <button
                          onClick={() => onReplayLine(line.translation)}
                          title="Speak translation"
                          className="p-1 rounded text-neutral-400 hover:text-[#E8552B] hover:bg-neutral-100 transition"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Source Utterance */}
                    <p className="text-xs text-neutral-500 font-normal leading-relaxed">
                      {line.text}
                    </p>

                    {/* Translated Text */}
                    {line.translation && (
                      <p className="text-xs text-neutral-900 font-medium leading-relaxed mt-1">
                        {line.translation}
                      </p>
                    )}
                  </div>
                );
              })
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* ================= TAB 3: SETTINGS & WORD LIST ================= */}
        {activeTab === "settings" && (
          <div className="space-y-5">
            {/* Target Language Preference */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
              <label className="text-xs font-bold text-neutral-700 block">
                Target Translation Language
              </label>
              <select
                value={targetLang}
                onChange={(e) => onTargetLangChange(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-neutral-300 bg-white text-neutral-800"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-500">
                Both subtitles and meeting minutes will be written in this language.
              </p>
            </div>

            {/* Custom Vocabulary / Word List */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-neutral-800">
                  Custom Word List &amp; Homophone Fixes
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Add domain jargon, project terms, or names that speech recognition frequently mishears.
                </p>
              </div>

              {/* Add Word Form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Correct word (e.g. Qubit)"
                  className="flex-1 text-xs p-2 rounded-xl border border-neutral-300 bg-white"
                />
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Note / Homophones"
                  className="flex-1 text-xs p-2 rounded-xl border border-neutral-300 bg-white"
                />
                <button
                  onClick={() => {
                    if (!newWord.trim()) return;
                    onAddVocabulary?.({
                      word: newWord.trim(),
                      note: newNote.trim(),
                      homophones: newNote ? [newNote.trim()] : [],
                    });
                    setNewWord("");
                    setNewNote("");
                    toast.success("Word added to Cicada glossary!");
                  }}
                  className="px-3 py-2 rounded-xl bg-[#E8552B] text-white text-xs font-medium hover:bg-[#d64720] transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Word List Items */}
              <div className="space-y-1.5 pt-2">
                {vocabulary.map((v) => (
                  <div
                    key={v.id || v.word}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-neutral-200 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-neutral-900">{v.word}</span>
                      {v.note && (
                        <span className="text-[10px] text-neutral-500 ml-2">
                          — {v.note}
                        </span>
                      )}
                    </div>
                    {onDeleteVocabulary && (
                      <button
                        onClick={() => onDeleteVocabulary(v.id || v.word)}
                        className="text-neutral-400 hover:text-red-500 transition p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3">
        <button
          onClick={onUpdateNotes}
          disabled={isUpdatingNotes}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#E8552B] hover:bg-[#d64720] text-white font-medium text-xs shadow-xs transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingNotes ? "animate-spin" : ""}`} />
          <span>{isUpdatingNotes ? "Updating..." : "Update Notes (更新速记)"}</span>
        </button>

        <button
          onClick={onGenerateFinalNotes}
          disabled={isUpdatingNotes || transcript.length === 0}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-medium text-xs transition disabled:opacity-50"
          title="Finalize meeting minutes"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Final Minutes (完整版)</span>
        </button>
      </div>
    </div>
  );
};

export default CicadaNotesDrawer;
