import React, { useState, useEffect, useRef } from "react";
import {
  Languages,
  ChevronDown,
  Volume2,
  FileText,
  Mic,
  Maximize2,
  Minimize2,
  MoveVertical,
  Type,
  X,
  Sparkles,
} from "lucide-react";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "zh", name: "简体中文", flag: "🇨🇳" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
];

/**
 * Cicada Subtitle Bar (知了实时字幕条)
 * Features:
 * - Floating non-intrusive overlay
 * - Fades to see-through (opacity-20) when mouse pointer passes over it
 * - Auto-tucks away into a subtle pill when quiet for > 4.5 seconds
 * - Shows source language & target translated subtitle
 * - Language switcher & text size adjustment
 */
const CicadaSubtitleBar = ({
  latestSubtitle,
  targetLang,
  onTargetLangChange,
  onOpenNotes,
  onToggleTalk,
  isRecordingTalk,
  onReplayAudio,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isTucked, setIsTucked] = useState(false);
  const [position, setPosition] = useState("bottom"); // "bottom" | "top"
  const [fontSize, setFontSize] = useState("lg"); // "md" | "lg" | "xl"
  const [showSettings, setShowSettings] = useState(false);
  const quietTimerRef = useRef(null);

  // Auto-hide / tuck away into a minimal pill after 5s of quiet
  useEffect(() => {
    if (!latestSubtitle?.text) return;

    setIsTucked(false);
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);

    quietTimerRef.current = setTimeout(() => {
      setIsTucked(true);
    }, 5000);

    return () => {
      if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
    };
  }, [latestSubtitle?.text, latestSubtitle?.translation]);

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLang) || SUPPORTED_LANGUAGES[0];

  const fontClass = {
    md: "text-base",
    lg: "text-lg",
    xl: "text-2xl",
  }[fontSize];

  // If tucked away, show the minimal Cicada pill
  if (isTucked && !isHovered) {
    return (
      <div
        className={`absolute ${
          position === "bottom" ? "bottom-20" : "top-20"
        } left-1/2 -translate-x-1/2 z-40 transition-all duration-300`}
      >
        <button
          onClick={() => setIsTucked(false)}
          onMouseEnter={() => setIsHovered(true)}
          className="flex items-center gap-2.5 px-4 py-2 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-full text-white/90 text-xs font-medium shadow-xl hover:bg-neutral-800 hover:scale-105 transition"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E8552B]"></span>
          </span>
          <span className="tracking-wide">Cicada · 知了字幕</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
            {currentLangObj.code}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowSettings(false);
      }}
      className={`absolute ${
        position === "bottom" ? "bottom-20" : "top-20"
      } left-1/2 -translate-x-1/2 w-11/12 max-w-4xl z-40 transition-all duration-300 pointer-events-auto ${
        isHovered ? "opacity-25 hover:opacity-100" : "opacity-95"
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl bg-neutral-950/85 backdrop-blur-xl border border-neutral-800/80 shadow-2xl text-white p-4">
        {/* Subtle orange accent indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E8552B] to-transparent opacity-80" />

        {/* Top bar controls */}
        <div className="flex items-center justify-between mb-2 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-neutral-200">
              <span className="inline-block w-2 h-2 rounded-full bg-[#E8552B] animate-pulse" />
              Cicada · 知了
            </span>
            {latestSubtitle?.speaker && (
              <span className="px-2 py-0.5 rounded-full bg-neutral-800/90 border border-neutral-700 text-neutral-300 text-[11px] font-medium">
                {latestSubtitle.speaker}
              </span>
            )}
            {latestSubtitle?.sourceLang && (
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
                {latestSubtitle.sourceLang} → {targetLang}
              </span>
            )}
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Target Language Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 text-xs transition"
              >
                <span>{currentLangObj.flag}</span>
                <span>{currentLangObj.name}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              {showSettings && (
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 z-50">
                  <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1">
                    Target Language
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          onTargetLangChange(lang.code);
                          setShowSettings(false);
                        }}
                        className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition ${
                          targetLang === lang.code
                            ? "bg-[#E8552B]/20 text-[#E8552B] font-medium"
                            : "text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                        {targetLang === lang.code && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Font size toggle */}
            <button
              onClick={() =>
                setFontSize((s) => (s === "md" ? "lg" : s === "lg" ? "xl" : "md"))
              }
              title="Change font size"
              className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition"
            >
              <Type className="w-3.5 h-3.5" />
            </button>

            {/* Dock Position toggle */}
            <button
              onClick={() => setPosition((p) => (p === "bottom" ? "top" : "bottom"))}
              title="Toggle top/bottom position"
              className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition"
            >
              <MoveVertical className="w-3.5 h-3.5" />
            </button>

            {/* Open Notes Drawer */}
            <button
              onClick={onOpenNotes}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 text-xs transition"
              title="Open Cicada Live Meeting Notes"
            >
              <FileText className="w-3.5 h-3.5 text-[#E8552B]" />
              <span>Notes</span>
            </button>

            {/* Tuck away */}
            <button
              onClick={() => setIsTucked(true)}
              className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
              title="Collapse subtitle bar"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtitle Lines Display */}
        <div className="space-y-1.5 text-center px-4 py-1">
          {/* Original Source Speech */}
          {latestSubtitle?.text && (
            <p className="text-sm font-normal text-neutral-400/90 leading-relaxed tracking-wide select-none">
              {latestSubtitle.text}
            </p>
          )}

          {/* Real-time Translated Subtitle */}
          <div className="flex items-center justify-center gap-2">
            <p
              className={`${fontClass} font-semibold text-white tracking-wide leading-relaxed drop-shadow-sm select-text`}
            >
              {latestSubtitle?.translation ||
                (latestSubtitle?.text ? latestSubtitle.text : "Waiting for speech…")}
            </p>

            {latestSubtitle?.translation && onReplayAudio && (
              <button
                onClick={() => onReplayAudio(latestSubtitle.translation)}
                title="Speak translation"
                className="opacity-70 hover:opacity-100 text-[#E8552B] transition p-1"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Non-intrusive hint when hovering */}
        {isHovered && (
          <div className="text-[10px] text-center text-neutral-400 mt-1 italic select-none">
            Subtitle bar fades under pointer so video &amp; controls underneath remain clickable
          </div>
        )}
      </div>
    </div>
  );
};

export default CicadaSubtitleBar;
