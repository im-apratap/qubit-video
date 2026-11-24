import { axiosInstance } from "./axios";

export async function getStreamToken(clerkToken) {
  const response = await axiosInstance.get("/chat/token", {
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
  });
  return response.data;
}

/**
 * Cicada Live Text Translation
 */
export async function translateText({ text, targetLang = "en", sourceLang = "auto" }) {
  const response = await axiosInstance.post("/translate/text", {
    text,
    targetLang,
    sourceLang,
  });
  return response.data;
}

/**
 * Cicada Meeting Notes Generation
 */
export async function generateMeetingNotesApi({ transcript, language = "English", currentNotes = {}, isFinal = false }) {
  const response = await axiosInstance.post("/notes/generate", {
    transcript,
    language,
    currentNotes,
    isFinal,
  });
  return response.data;
}

/**
 * Cicada Meeting Sessions Management
 */
export async function getMeetingSessions() {
  const response = await axiosInstance.get("/sessions");
  return response.data;
}

export async function getMeetingSession(id) {
  const response = await axiosInstance.get(`/sessions/${id}`);
  return response.data;
}

export async function saveMeetingSession(sessionData) {
  const response = await axiosInstance.post("/sessions", sessionData);
  return response.data;
}

export async function deleteMeetingSession(id) {
  const response = await axiosInstance.delete(`/sessions/${id}`);
  return response.data;
}

/**
 * Cicada Custom Vocabulary & Homophones
 */
export async function getVocabulary() {
  const response = await axiosInstance.get("/vocabulary");
  return response.data;
}

export async function addVocabulary(data) {
  const response = await axiosInstance.post("/vocabulary", data);
  return response.data;
}

export async function deleteVocabulary(id) {
  const response = await axiosInstance.delete(`/vocabulary/${id}`);
  return response.data;
}
