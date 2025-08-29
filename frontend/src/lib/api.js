import { axiosInstance } from "./axios";

export async function getStreamToken(clerkToken) {
  const response = await axiosInstance.get("/chat/token", {
    headers: {
      Authorization: `Bearer ${clerkToken}`, // 👈 send Clerk JWT
    },
  });
  return response.data;
}
