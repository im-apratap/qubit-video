import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  Volume2,
  Languages,
  X,
  AudioLines,
  Loader2,
  Sparkles,
  Radio,
} from "lucide-react";
import { speakText } from "../lib/tts";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

/**
 * Cicada Simultaneous Interpreting / Push-to-Talk (同声传译)
 * Features:
 * - Push-to-Talk (hold talk or click to talk)
 * - Hands-Free mode toggle
 * - Translates speech to target language
 * - Speaks the translated output aloud into the call via Nari TTS or Web Speech API
 */
const CicadaInterpreter = ({
  callId,
  userId,
  targetLang = "en",
  onNewUtterance,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [voice, setVoice] = useState("diana"); // "diana" | "leon"
  const [lastTranslation, setLastTranslation] = useState("");
  const [lastOriginal, setLastOriginal] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const currentAudioRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      currentAudioRef.current?.pause?.();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  // Keyboard shortcut listener: Spacebar when not typing in inputs
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && !e.repeat && !isRecording && !isTranslating) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          startRecording();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space" && isRecording && !handsFree) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          stopRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording, isTranslating, handsFree]);

  const startRecording = async () => {
    if (isTranslating) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio analyzer for wave visualization
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      audioContextRef.current = audioCtx;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setAudioLevel(Math.min(100, Math.floor(sum / dataArray.length)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        submitRecording();
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      toast.error("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  const submitRecording = async () => {
    setIsTranslating(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size === 0) {
        setIsTranslating(false);
        return;
      }

      const formData = new FormData();
      formData.append("audio", blob, "speech.webm");
      formData.append("callId", callId || "call");
      formData.append("userId", userId || "user");
      formData.append("targetLang", targetLang);
      formData.append("voice", voice);

      const { data } = await axiosInstance.post("/translate", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const translated = data.translation || "(no speech recognized)";
      const original = data.originalText || "(speech audio)";

      setLastTranslation(translated);
      setLastOriginal(original);

      // Emit new utterance for live subtitles & transcript
      onNewUtterance?.({
        speaker: "You",
        text: original,
        translation: translated,
        lang: data.detectedLang || "auto",
        targetLang,
      });

      // Speak translated output into the room
      if (data.translation) {
        try {
          setIsSpeaking(true);
          currentAudioRef.current = await speakText({
            text: data.translation,
            voice: data.voice || voice,
            lang: targetLang,
          });
        } catch (ttsErr) {
          console.warn("TTS playback warning:", ttsErr);
        } finally {
          setIsSpeaking(false);
        }
      }
    } catch (err) {
      console.error("Translation failed:", err);
      toast.error("Simultaneous interpretation failed. Check backend/service.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="absolute top-16 left-4 w-84 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-200/90 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#E8552B] flex items-center justify-center text-white">
            <Languages className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-neutral-800 text-xs">
              Simultaneous Interpreting · 同声传译
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Voice & Hands-Free controls */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500 text-[11px]">Voice:</span>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="text-xs p-1 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800 font-medium"
            >
              <option value="diana">Diana (Female)</option>
              <option value="leon">Leon (Male)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-600 select-none">
            <input
              type="checkbox"
              checked={handsFree}
              onChange={(e) => setHandsFree(e.target.checked)}
              className="rounded text-[#E8552B] focus:ring-[#E8552B]"
            />
            <span>Hands-Free</span>
          </label>
        </div>

        {/* Big Talk Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranslating}
          className={`w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-bold text-sm shadow-md transition-all ${
            isRecording
              ? "bg-red-600 text-white animate-pulse"
              : "bg-[#E8552B] hover:bg-[#d64720] text-white"
          } disabled:opacity-50`}
        >
          {isRecording ? (
            <>
              <Square className="w-5 h-5" />
              <span>Stop &amp; Translate</span>
              <span className="text-[10px] font-normal opacity-90">Listening… release or click to translate</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>{handsFree ? "Start Hands-Free" : "Hold or Click to Speak"}</span>
              <span className="text-[10px] font-normal opacity-90">
                Translates into {targetLang.toUpperCase()} &amp; speaks aloud
              </span>
            </>
          )}
        </button>

        {/* Audio Wave Visualizer */}
        {isRecording && (
          <div className="space-y-1">
            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-75"
                style={{ width: `${Math.max(10, audioLevel)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span className="flex items-center gap-1 text-red-500 font-medium animate-pulse">
                <AudioLines className="w-3 h-3" /> Voice active
              </span>
              <span>Spacebar shortcut</span>
            </div>
          </div>
        )}

        {/* Status Indicators */}
        {isTranslating && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-neutral-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E8552B]" />
            <span>Transcribing &amp; translating speech…</span>
          </div>
        )}

        {isSpeaking && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#E8552B] font-medium animate-pulse">
            <Volume2 className="w-4 h-4" />
            <span>Speaking translation into call…</span>
          </div>
        )}

        {/* Last Translation Card */}
        {lastTranslation && !isTranslating && (
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1">
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Spoken to meeting ({targetLang.toUpperCase()}):
            </div>
            <p className="text-neutral-900 font-semibold leading-relaxed">
              {lastTranslation}
            </p>
            {lastOriginal && (
              <p className="text-[11px] text-neutral-400 italic">
                Original: "{lastOriginal}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CicadaInterpreter;
