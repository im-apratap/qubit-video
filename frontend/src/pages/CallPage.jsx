import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";

import { getStreamToken } from "../lib/api";

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

import { MessageCircleIcon, XIcon, Languages } from "lucide-react";
import { useStreamChat } from "../hooks/useStreamChat.js";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";
// If you use a custom theme like in HomePage, you can also import it:
// import "../styles/stream-chat-theme.css";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const CallPage = () => {
  const { id: callId } = useParams();
  const { user, isLoaded } = useUser();

  const [videoClient, setVideoClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  // Chat drawer toggle
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Use your existing hook (already connects the Stream Chat client)
  const { chatClient, error: chatError } = useStreamChat();
  const [channel, setChannel] = useState(null);

  // Video token (same API you already use)
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
            name: user.fullName,
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

  // Setup (or join/watch) the Stream Chat channel that matches this call
  useEffect(() => {
    let mounted = true;

    const setupChannel = async () => {
      if (!chatClient || !callId || !user) return;

      const ch = chatClient.channel("messaging", callId, {
        name: `Call Chat ${callId}`,
      });

      try {
        // Start watching the channel (creates if needed when you call .create() first)
        await ch.watch();
        // Make sure current user is a member (no-op if already a member)
        try {
          await ch.addMembers([user.id]);
        } catch {
          /* ignore if already a member or permissions prevent it */
        }

        if (mounted) setChannel(ch);
      } catch (e) {
        // Fallback: create then watch
        try {
          await ch.create();
          await ch.addMembers([user.id]);
          await ch.watch();
          if (mounted) setChannel(ch);
        } catch (err) {
          console.error("Chat channel setup failed:", err);
          toast.error("Chat is unavailable.");
        }
      }
    };

    setupChannel();
    return () => {
      mounted = false;
    };
  }, [chatClient, callId, user]);

  if (isConnecting || !isLoaded) {
    return (
      <div className="h-screen flex justify-center items-center">
        Connecting to call...
      </div>
    );
  }

  if (chatError) {
    console.warn("Stream Chat error:", chatError);
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative">
      {/* Video area */}
      <div className="relative flex-1 flex items-center justify-center">
        {videoClient && call ? (
          <StreamVideo client={videoClient}>
            <StreamCall call={call}>
              <CallContent />
            </StreamCall>
          </StreamVideo>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-base sm:text-lg md:text-xl text-gray-600">
              Could not initialize call. Please refresh or try again later.
            </p>
          </div>
        )}
      </div>

      {/* Chat toggle button */}
      <button
        onClick={() => setIsChatOpen((v) => !v)}
        className="absolute top-4 right-4 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition font-medium text-sm"
        aria-label={isChatOpen ? "Close chat" : "Open chat"}
      >
        {isChatOpen ? (
          <XIcon className="size-5" />
        ) : (
          <MessageCircleIcon className="size-5" />
        )}
        <span>Chat</span>
      </button>

      <button
        onClick={() => toast.success("Language selector coming soon!")}
        className="absolute top-4 left-4 p-3 rounded-full bg-white text-gray-600 shadow-md hover:bg-gray-100 transition flex items-center justify-center"
        aria-label="Change language"
      >
        <Languages className="size-5" />
        <span>Translate</span>
      </button>

      {/* Chat Drawer */}
      {isChatOpen && chatClient && channel && (
        <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-xl border-l z-50 flex flex-col">
          <Chat client={chatClient} theme="messaging light">
            <Channel channel={channel}>
              <Window>
                {/* Custom header WITH close button kept inside Window */}
                <div className="flex items-center justify-between p-3 border-b">
                  <span className="font-medium text-gray-700">Call Chat</span>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 rounded-full hover:bg-gray-200"
                    aria-label="Close chat"
                  >
                    <XIcon className="size-5 text-gray-600" />
                  </button>
                </div>

                {/* Messages + Input */}
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

const CallContent = () => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const navigate = useNavigate();

  // Handle the "LEFT" calling state
  if (callingState === CallingState.LEFT) {
    // Attempt to close the tab
    const tabClosed = window.close();
    if (!tabClosed) {
      // If `window.close()` fails, navigate to `/` and refresh the page
      navigate("/");
      window.location.reload();
    }
    return null; // Ensure the component doesn't render anything after this
  }

  return (
    <StreamTheme>
      <SpeakerLayout />
      <CallControls />
    </StreamTheme>
  );
};

export default CallPage;
