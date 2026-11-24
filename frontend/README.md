# Qubit Video with Cicada (知了) AI Features

This is a modern video-conferencing platform powered by React, Tailwind, Stream Video & Audio, Stream Chat, Clerk, and an end-to-end integration of **Cicada (知了)** for real-time bilingual subtitles, AI live meeting notes, and simultaneous interpretation.

## Cicada (知了) Feature Set

### 1. Dynamic Non-Intrusive Floating Subtitle Bar
- **Bilingual Subtitles**: Displays real-time spoken text and translated subtitles with automatic language detection.
- **See-Through Hover**: Hovering over the subtitle bar fades its opacity to 25%, ensuring video feeds, shared screens, and call controls underneath remain visible and interactive.
- **Auto Tuck-Away**: Automatically tucks away into a sleek, minimal indicator pill after 5 seconds of silence, and expands automatically when speech resumes.
- **Customizable**: Toggle between bottom and top positions, adjust typography sizing (Medium, Large, XL), and switch target languages (English, 简体中文, Español, 日本語, 한국어, Français, Deutsch, हिन्दी).

### 2. AI Live Meeting Notes & Minutes (速记版 & 完整版)
- **Live Executive Summary**: Concise overview updated as the conversation progresses.
- **Chronological Topics**: Discussion segmented by topics with `[mm:ss]` timestamps, summaries, and key takeaways.
- **Cause-and-Effect Fishbone Diagram (因果鱼骨图)**: Visual root-cause and factor breakdown for discussion topics.
- **Conclusions & Decisions**: Key agreements with line citations.
- **Action Items & To-dos**: Track action items with assigned owners (`You`, `Them`, participant names) and line citations.
- **Interactive Evidence Navigation**: Clicking any timestamp or evidence citation (`[L3]`, `[01:14]`) immediately jumps to and highlights the corresponding line in the bilingual transcript.
- **Export & Share**:
  - **Copy Notes**: One-click Markdown copy for Notion, Slack, Feishu, or Google Docs.
  - **Export Markdown (`.md`)**: Download full structured meeting notes.
  - **Export Subtitles (`.srt`)**: Download timed bilingual subtitles.
  - **Export Session JSON (`.json`)**: Download complete session transcript and metadata.

### 3. Bilingual Transcript & Audio Replay
- Full timeline with line IDs, timestamps, speaker attribution, source speech, and translated lines.
- Click the speaker icon on any line to play its spoken translation aloud.
- Fast full-text search with instant highlight filtering.

### 4. Simultaneous Interpreting / Push-to-Talk (同声传译)
- Hold or click to speak (Spacebar shortcut supported).
- **Hands-Free Mode**: Auto-detects speech and pauses to translate on the fly.
- Live audio waveform and voice activity meter.
- Translates speech and speaks it into the call using Nari Labs TTS (or Web Speech API fallback) so other participants hear the user in their language.
- Voice selection: `diana` (female) or `leon` (male).

### 5. Meeting Records Archive (会议记录)
- Saved sessions accessible directly from the dashboard sidebar via **Meeting Records (知了)**.
- Review past call summaries, fishbone diagrams, to-dos, and bilingual transcripts anytime.

### 6. Custom Word List & Homophone Correction
- Configure specialized domain jargon, names, and acronyms (e.g. "Qubit", "WebRTC", "Cicada") to guarantee speech recognition accuracy.

---

## Getting Started

1. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Configure environment variables:
   - Copy `backend/.env.example` to `backend/.env`
   - Copy `frontend/.env.example` to `frontend/.env`
   - Set `STREAM_API_KEY`, `STREAM_API_SECRET`, `CLERK_PUBLISHABLE_KEY`, and optionally `OPENAI_API_KEY` / `NARI_API_KEY`.

3. Run the development servers:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev

   # Terminal 3 (Optional local Whisper):
   cd backend/translate-python && python translate.py
   ```
