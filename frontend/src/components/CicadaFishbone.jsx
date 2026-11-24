import React from "react";
import { GitFork, Clock } from "lucide-react";

/**
 * Format seconds to mm:ss
 */
function formatTime(sec) {
  if (sec == null) return "";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/**
 * Cicada Fishbone Diagram (因果鱼骨图)
 * Visualizes root-causes, factors, and reasons discussed during a topic.
 */
const CicadaFishbone = ({ fishbone, onJump }) => {
  if (!fishbone || !fishbone.branches || fishbone.branches.length === 0) return null;

  const { question, branches } = fishbone;

  return (
    <div className="my-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 shadow-xs">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <GitFork className="w-4 h-4 text-[#E8552B]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Cause-and-Effect Analysis · 因果鱼骨图
        </span>
      </div>

      {/* Central Question / Core Problem */}
      <div className="inline-block px-3 py-1.5 rounded-lg bg-[#E8552B]/10 border border-[#E8552B]/20 text-[#E8552B] font-semibold text-xs mb-4">
        {question}
      </div>

      {/* Visual Fishbone SVG Diagram */}
      <div className="relative w-full overflow-x-auto py-2">
        <div className="min-w-[420px] max-w-full">
          {/* Main Spine with branches */}
          <div className="grid grid-cols-2 gap-3 relative">
            {branches.map((branch, index) => {
              const isEven = index % 2 === 0;
              return (
                <div
                  key={index}
                  className={`relative p-3 rounded-xl border bg-white shadow-xs transition hover:border-[#E8552B]/40 ${
                    isEven ? "border-l-4 border-l-[#E8552B]" : "border-r-4 border-r-[#E8552B]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-neutral-800">
                      {branch.label}
                    </span>
                    {branch.t != null && onJump && (
                      <button
                        onClick={() => onJump(branch.t)}
                        className="flex items-center gap-1 text-[10px] font-mono font-medium text-[#E8552B] hover:underline"
                        title="Jump to transcript line"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatTime(branch.t)}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-600 leading-snug">
                    {branch.detail}
                  </p>
                  {branch.evidence && branch.evidence.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-400">
                      <span>Evidence:</span>
                      <span className="font-mono">{branch.evidence.join(", ")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Central spine line graphic */}
          <div className="flex items-center justify-between my-2">
            <div className="h-0.5 flex-1 bg-gradient-to-r from-[#E8552B] to-neutral-300" />
            <div className="w-3 h-3 rotate-45 border-t-2 border-r-2 border-[#E8552B] -ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CicadaFishbone;
