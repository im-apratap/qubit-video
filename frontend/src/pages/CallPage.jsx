import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";

import {
  getStreamToken,
  translateText,
  generateMeetingNotesApi,
  saveMeetingSession,
  getVocabulary,
  addVocabulary,
  deleteVocabulary,
} from "../lib/api";

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  CallControls,
  SpeakerLayout,
  StreamTheme,
  CallingState,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";

import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Window,
} from "stream-chat-react";

import {
  MessageCircleIcon,
  XIcon,
  Languages,
  FileText,
  Mic,
  Subtitles,
  Sparkles,
} from "lucide-react";

import { useStreamChat } from "../hooks/useStreamChat.js";
import { speakText } from "../lib/tts";
import CicadaSubtitleBar from "../components/CicadaSubtitleBar";
import CicadaNotesDrawer from "../components/CicadaNotesDrawer";
import CicadaInterpreter from "../components/CicadaInterpreter";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const CallPage = () => {
  const { id: callId } = useParams();
  const { user, isLoaded } = useUser();

  const [videoClient, setVideoClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  // Panels & Drawers
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isInterpreterOpen, setIsInterpreterOpen] = useState(false);
  const [isSubtitlesEnabled, setIsSubtitlesEnabled] = useState(true);

  // Cicada Core State
  const [targetLang, setTargetLang] = useState("en");
  const [transcript, setTranscript] = useState([]);
  const [latestSubtitle, setLatestSubtitle] = useState(null);
  const [notes, setNotes] = useState(null);
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);
  const [vocabulary, setVocabulary] = useState([]);

  const startTimeRef = useRef(Date.now());
  const recognitionRef = useRef(null);
  const notesTimerRef = useRef(null);
  const lastCoveredCountRef = useRef(0);

  // Use existing hook for Stream Chat
  const { chatClient, error: chatError } = useStreamChat();
  const [channel, setChannel] = useState(null);

  // Video token query
  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!user,
  });

  // Initialize Stream Video call
  useEffect(() => {
    const initCall = async () => {
      if (!tokenData?.token || !user || !callId) return;

      try {
        const vClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: {
            id: user.id,
            name: user.fullName || "User",
            image: user.imageUrl,
          },
          token: tokenData.token,
        });

        const callInstance = vClient.call("default", callId);
        await callInstance.join({ create: true });

        setVideoClient(vClient);
        setCall(callInstance);
      } catch (error) {
        console.error("Error init call:", error);
        toast.error("Cannot connect to the call.");
      } finally {
        setIsConnecting(false);
      }
    };

    initCall();
  }, [tokenData, user, callId]);

  // Setup Stream Chat channel
  useEffect(() => {
    let mounted = true;
    const setupChannel = async () => {
      if (!chatClient || !callId || !user) return;

      const ch = chatClient.channel("messaging", callId, {
        name: `Call Chat ${callId}`,
      });

      try {
        await ch.watch();
        try {
          await ch.addMembers([user.id]);
        } catch {
          // ignore if member
        }
        if (mounted) setChannel(ch);
      } catch (e) {
        try {
          await ch.create();
          await ch.addMembers([user.id]);
          await ch.watch();
          if (mounted) setChannel(ch);
        } catch (err) {
          console.error("Chat channel setup failed:", err);
        }
      }
    };

    setupChannel();
    return () => {
      mounted = false;
    };
  }, [chatClient, callId, user]);

  // Load custom vocabulary
  useEffect(() => {
    getVocabulary()
      .then((data) => {
        if (data?.vocabulary) setVocabulary(data.vocabulary);
      })
      .catch(() => {});
  }, []);

  // Web Speech API for Live Real-time Subtitles & Transcriptions
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Browser SpeechRecognition not supported. Simultaneous interpreting will handle audio capture.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = async (event) => {
        const lastResult = event.results[event.results.length - 1];
        const text = lastResult[0]?.transcript?.trim();
        if (!text) return;

        const isFinal = lastResult.isFinal;
        const currentElapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);

        if (isFinal) {
          // Translate final phrase to target language
          try {
            const trData = await translateText({ text, targetLang });
            const translated = trData.translation || text;

            const newLine = {
              id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              t: currentElapsedSec,
              speaker: user?.fullName || "You",
              text,
              translation: translated,
              lang: "auto",
              targetLang,
            };

            setTranscript((prev) => [...prev, newLine]);
            setLatestSubtitle({
              speaker: user?.fullName || "You",
              text,
              translation: translated,
              sourceLang: "auto",
            });
          } catch (err) {
            console.warn("Live translation error:", err);
          }
        } else {
          // Interim subtitle preview
          setLatestSubtitle({
            speaker: user?.fullName || "You",
            text,
            translation: text,
            sourceLang: "auto",
          });
        }
      };

      recognition.onerror = (e) => {
        if (e.error !== "no-speech") {
          console.warn("Speech recognition warning:", e.error);
        }
      };

      recognition.onend = () => {
        // Auto-restart continuous recognition while in call
        try {
          recognition.start();
        } catch {
          // ignore if already started
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Failed to start SpeechRecognition:", err);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [targetLang, user?.fullName]);

  // Handle new utterance from Simultaneous Interpreting panel
  const handleNewUtterance = useCallback(
    (item) => {
      const currentElapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const newLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        t: currentElapsedSec,
        speaker: item.speaker || "You",
        text: item.text,
        translation: item.translation,
        lang: item.lang || "auto",
        targetLang: item.targetLang || targetLang,
      };

      setTranscript((prev) => [...prev, newLine]);
      setLatestSubtitle({
        speaker: item.speaker || "You",
        text: item.text,
        translation: item.translation,
        sourceLang: item.lang || "auto",
      });
    },
    [targetLang]
  );

  // Trigger Cicada Live Notes Update
  const updateMeetingNotes = useCallback(
    async (isFinal = false) => {
      if (transcript.length === 0) return;
      setIsUpdatingNotes(true);

      try {
        const langName =
          targetLang === "zh"
            ? "Simplified Chinese"
            : targetLang === "es"
            ? "Spanish"
            : targetLang === "ja"
            ? "Japanese"
            : targetLang === "fr"
            ? "French"
            : targetLang === "de"
            ? "German"
            : targetLang === "hi"
            ? "Hindi"
            : "English";

        const data = await generateMeetingNotesApi({
          transcript,
          language: langName,
          currentNotes: notes || {},
          isFinal,
        });

        if (data?.notes) {
          setNotes(data.notes);
          lastCoveredCountRef.current = transcript.length;
          if (isFinal) {
            toast.success("Final meeting minutes generated!");
          }
        }
      } catch (err) {
        console.error("Notes update error:", err);
      } finally {
        setIsUpdatingNotes(false);
      }
    },
    [transcript, notes, targetLang]
  );

  // Periodic automatic note updates every 45s (Cicada interval) if > 2 new lines
  useEffect(() => {
    if (notesTimerRef.current) clearInterval(notesTimerRef.current);

    notesTimerRef.current = setInterval(() => {
      const newLines = transcript.length - lastCoveredCountRef.current;
      if (newLines >= 2) {
        updateMeetingNotes(false);
      }
    }, 45000);

    return () => {
      if (notesTimerRef.current) clearInterval(notesTimerRef.current);
    };
  }, [transcript.length, updateMeetingNotes]);

  // Save session when call ends
  const handleSaveSession = useCallback(
    async (finalNotes) => {
      if (transcript.length === 0) return;
      const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000);

      try {
        await saveMeetingSession({
          callId,
          title: finalNotes?.title || notes?.title || `Meeting ${callId}`,
          userId: user?.id,
          participants: [user?.fullName || "User"],
          startedAt: new Date(startTimeRef.current),
          endedAt: new Date(),
          duration: durationSec,
          transcript,
          notes: finalNotes || notes || {},
          vocabulary: vocabulary.map((v) => v.word),
        });
      } catch (err) {
        console.warn("Auto-saving meeting session error:", err);
      }
    },
    [callId, user, transcript, notes, vocabulary]
  );

  // Save session on unmount
  useEffect(() => {
    return () => {
      handleSaveSession(notes);
    };
  }, [handleSaveSession, notes]);

  // Word List Handlers
  const handleAddVocabulary = async (item) => {
    try {
      const res = await addVocabulary(item);
      if (res?.vocabulary) setVocabulary(res.vocabulary);
    } catch (e) {
      console.warn("Add vocabulary error:", e);
    }
  };

  const handleDeleteVocabulary = async (id) => {
    try {
      const res = await deleteVocabulary(id);
      if (res?.vocabulary) setVocabulary(res.vocabulary);
    } catch (e) {
      console.warn("Delete vocabulary error:", e);
    }
  };

  // Replay Line Audio / TTS
  const handleReplayLine = async (text) => {
    try {
      await speakText({ text, lang: targetLang });
    } catch (e) {
      toast.error("Could not play audio");
    }
  };

  if (isConnecting || !isLoaded) {
    return (
      <div className="h-screen flex flex-col justify-center items-center bg-neutral-900 text-white gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#E8552B] border-t-transparent animate-spin" />
        <span className="text-sm font-medium">Connecting to call…</span>
      </div>
    );
  }

  if (chatError) {
    console.warn("Stream Chat error:", chatError);
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 relative overflow-hidden select-none">
      {/* Video Stream Area */}
      <div className="relative flex-1 flex items-center justify-center">
        {videoClient && call ? (
          <StreamVideo client={videoClient}>
            <StreamCall call={call}>
              <CallContent onLeave={() => handleSaveSession(notes)} />
            </StreamCall>
          </StreamVideo>
        ) : (
          <div className="flex items-center justify-center h-full text-center text-gray-400">
            <p className="text-base sm:text-lg">
              Could not initialize call. Please refresh or try again later.
            </p>
          </div>
        )}
      </div>

      {/* Top Left Toolbar: Cicada Live Notes & Interpreting */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
        {/* Cicada Live Notes Button */}
        <button
          onClick={() => setIsNotesOpen((v) => !v)}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full shadow-lg font-medium text-xs transition backdrop-blur-md ${
            isNotesOpen
              ? "bg-[#E8552B] text-white hover:bg-[#d64720]"
              : "bg-white/90 hover:bg-white text-neutral-800"
          }`}
          title="Open Cicada Live Meeting Notes"
        >
          <div className="w-4 h-4 rounded bg-[#E8552B] text-white flex items-center justify-center text-[10px] font-bold">
            知
          </div>
          <span>Live Notes</span>
          {transcript.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#E8552B] animate-pulse" />
          )}
        </button>

        {/* Simultaneous Interpreting Button */}
        <button
          onClick={() => setIsInterpreterOpen((v) => !v)}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full shadow-lg font-medium text-xs transition backdrop-blur-md ${
            isInterpreterOpen
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-white/90 hover:bg-white text-neutral-800"
          }`}
          title="Open Simultaneous Interpreting"
        >
          <Languages className="w-4 h-4 text-blue-600" />
          <span>Interpret (同传)</span>
        </button>

        {/* Toggle Subtitles Button */}
        <button
          onClick={() => setIsSubtitlesEnabled((v) => !v)}
          className={`p-2.5 rounded-full shadow-lg transition backdrop-blur-md ${
            isSubtitlesEnabled
              ? "bg-white/90 text-[#E8552B] hover:bg-white"
              : "bg-neutral-800/80 text-neutral-400 hover:bg-neutral-800"
          }`}
          title={isSubtitlesEnabled ? "Hide Subtitles" : "Show Subtitles"}
        >
          <Subtitles className="w-4 h-4" />
        </button>
      </div>

      {/* Top Right Toolbar: Chat Drawer Button */}
      <div className="absolute top-4 right-4 z-40">
        <button
          onClick={() => setIsChatOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition font-medium text-xs"
          aria-label={isChatOpen ? "Close chat" : "Open chat"}
        >
          {isChatOpen ? <XIcon className="w-4 h-4" /> : <MessageCircleIcon className="w-4 h-4" />}
          <span>Chat</span>
        </button>
      </div>

      {/* Cicada Floating Subtitle Bar (Non-intrusive) */}
      {isSubtitlesEnabled && (
        <CicadaSubtitleBar
          latestSubtitle={latestSubtitle}
          targetLang={targetLang}
          onTargetLangChange={setTargetLang}
          onOpenNotes={() => setIsNotesOpen(true)}
          onToggleTalk={() => setIsInterpreterOpen((v) => !v)}
          isRecordingTalk={false}
          onReplayAudio={handleReplayLine}
        />
      )}

      {/* Cicada Live Meeting Notes Drawer */}
      <CicadaNotesDrawer
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        callId={callId}
        notes={notes}
        transcript={transcript}
        isUpdatingNotes={isUpdatingNotes}
        onUpdateNotes={() => updateMeetingNotes(false)}
        onGenerateFinalNotes={() => updateMeetingNotes(true)}
        onReplayLine={handleReplayLine}
        targetLang={targetLang}
        onTargetLangChange={setTargetLang}
        vocabulary={vocabulary}
        onAddVocabulary={handleAddVocabulary}
        onDeleteVocabulary={handleDeleteVocabulary}
      />

      {/* Cicada Simultaneous Interpreting Panel */}
      {isInterpreterOpen && (
        <CicadaInterpreter
          callId={callId}
          userId={user?.id}
          targetLang={targetLang}
          onNewUtterance={handleNewUtterance}
          onClose={() => setIsInterpreterOpen(false)}
        />
      )}

      {/* Stream Chat Drawer */}
      {isChatOpen && chatClient && channel && (
        <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-neutral-200 z-50 flex flex-col">
          <Chat client={chatClient} theme="messaging light">
            <Channel channel={channel}>
              <Window>
                <div className="flex items-center justify-between p-3.5 border-b border-neutral-200 bg-neutral-50">
                  <span className="font-semibold text-neutral-800 text-sm">Call Chat</span>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 rounded-lg hover:bg-neutral-200 text-neutral-500"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
                <MessageList />
                <MessageInput focus />
              </Window>
            </Channel>
          </Chat>
        </div>
      )}
    </div>
  );
};

const CallContent = ({ onLeave }) => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const navigate = useNavigate();

  // If user leaves the call
  if (callingState === CallingState.LEFT) {
    onLeave?.();
    const tabClosed = window.close();
    if (!tabClosed) {
      navigate("/");
      window.location.reload();
    }
    return null;
  }

  return (
    <StreamTheme>
      <SpeakerLayout />
      <CallControls />
    </StreamTheme>
  );
};

export default CallPage;
