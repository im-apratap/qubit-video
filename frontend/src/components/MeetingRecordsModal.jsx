import React, { useState, useEffect } from "react";
import {
  History,
  X,
  FileText,
  Clock,
  Download,
  Trash2,
  ChevronRight,
  Sparkles,
  Calendar,
  Languages,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { getMeetingSessions, deleteMeetingSession } from "../lib/api";
import CicadaFishbone from "./CicadaFishbone";
import toast from "react-hot-toast";

function formatClock(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

const MeetingRecordsModal = ({ isOpen, onClose }) => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await getMeetingSessions();
      if (data?.sessions) {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !selectedSession) {
          setSelectedSession(data.sessions[0]);
        }
      }
    } catch (err) {
      console.warn("Could not load sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteMeetingSession(id);
      setSessions((prev) => prev.filter((s) => s.callId !== id && s._id !== id));
      if (selectedSession?.callId === id || selectedSession?._id === id) {
        setSelectedSession(null);
      }
      toast.success("Meeting record removed");
    } catch (err) {
      toast.error("Failed to delete record");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8552B] flex items-center justify-center text-white shadow-xs">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Cicada Meeting Records · 会议记录
              </h2>
              <p className="text-xs text-neutral-500">
                Bilingual transcripts, AI notes, and action items from your past calls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Session List */}
          <div className="w-80 border-r border-neutral-200 bg-neutral-50/40 flex flex-col overflow-y-auto">
            <div className="p-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Saved Meetings ({sessions.length})
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs text-neutral-400">
                Loading records…
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400 space-y-1">
                <p>No meeting records found.</p>
                <p className="text-[11px]">Records are automatically saved when you finish a call.</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {sessions.map((sess) => {
                  const isSelected =
                    selectedSession?.callId === sess.callId ||
                    selectedSession?._id === sess._id;
                  const date = new Date(sess.startedAt || sess.createdAt).toLocaleDateString();
                  return (
                    <div
                      key={sess._id || sess.callId}
                      onClick={() => setSelectedSession(sess)}
                      className={`p-3 rounded-2xl cursor-pointer transition text-xs flex items-center justify-between group ${
                        isSelected
                          ? "bg-white border border-neutral-200 shadow-sm text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="font-semibold text-neutral-900 truncate">
                          {sess.title || `Call ${sess.callId}`}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {date}
                          </span>
                          <span>•</span>
                          <span>{sess.transcript?.length || 0} lines</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDelete(sess.callId || sess._id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-neutral-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Session Details */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {selectedSession ? (
              <div className="space-y-6 max-w-3xl">
                {/* Details Header */}
                <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900">
                      {selectedSession.title || `Meeting ${selectedSession.callId}`}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(
                          selectedSession.startedAt || selectedSession.createdAt
                        ).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>Call ID: {selectedSession.callId}</span>
                      <span>•</span>
                      <span>{selectedSession.transcript?.length || 0} transcript lines</span>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {selectedSession.notes?.summary && (
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      Summary · 会议总结
                    </span>
                    <p className="text-xs text-neutral-800 leading-relaxed font-normal">
                      {selectedSession.notes.summary}
                    </p>
                  </div>
                )}

                {/* Topics & Fishbone */}
                {selectedSession.notes?.topics?.map((topic, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#E8552B]">
                        [{formatClock(topic.start)}]
                      </span>
                      <h4 className="text-xs font-bold text-neutral-900">
                        {topic.title}
                      </h4>
                    </div>
                    {topic.summary && (
                      <p className="text-xs text-neutral-600 italic">
                        {topic.summary}
                      </p>
                    )}
                    {topic.points && (
                      <ul className="space-y-1 text-xs text-neutral-700 pt-1">
                        {topic.points.map((p, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E8552B] mt-1.5 shrink-0" />
                            <span>{typeof p === "string" ? p : p.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {topic.fishbone && <CicadaFishbone fishbone={topic.fishbone} />}
                  </div>
                ))}

                {/* Bilingual Transcript Preview */}
                {selectedSession.transcript && selectedSession.transcript.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Bilingual Transcript · 双语转录
                    </h4>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 divide-y divide-neutral-200/60 max-h-96 overflow-y-auto space-y-2">
                      {selectedSession.transcript.map((line, idx) => (
                        <div key={idx} className="pt-2 text-xs space-y-0.5">
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                            <span>L{idx + 1}</span>
                            <span>{formatClock(line.t || idx * 10)}</span>
                            <span className="font-semibold text-neutral-600">
                              {line.speaker || "Speaker"}
                            </span>
                          </div>
                          <p className="text-neutral-500">{line.text}</p>
                          {line.translation && (
                            <p className="text-neutral-900 font-medium">
                              {line.translation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-neutral-400 text-xs">
                Select a meeting record to view its notes and transcript
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingRecordsModal;
