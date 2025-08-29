import { useEffect, useState, useRef } from "react";
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
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "./CallPage.css"; // Import our custom styles

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

// Theme toggle component (you were using it but hadn’t defined it)
const ThemeToggle = ({ toggle }) => {
  return (
    <button
      onClick={toggle}
      className="fixed top-4 left-4 z-50 px-4 py-2 rounded-lg shadow-lg bg-gray-800 text-white hover:bg-gray-700 transition"
    >
      Toggle Theme
    </button>
  );
};

const CallPage = () => {
  const { id: callId } = useParams();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [connectionPhase, setConnectionPhase] = useState("initial");
  const [videoSize, setVideoSize] = useState(90);
  const [theme, setTheme] = useState("dark");
  const timeoutRef = useRef(null);
  const slowTimeoutRef = useRef(null);

  const {
    data: tokenData,
    isLoading: isTokenLoading,
    isError: isTokenError,
  } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const isLoadingInitialData = !isUserLoaded || isTokenLoading || !user;

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("call-theme", newTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("call-theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const handleVideoSizeChange = (newSize) => {
    setVideoSize(Math.max(50, Math.min(100, newSize)));
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      handleVideoSizeChange(videoSize + delta);
    }
  };

  useEffect(() => {
    const initCall = async () => {
      if (
        isLoadingInitialData ||
        isTokenError ||
        !tokenData?.token ||
        !callId
      ) {
        if (!isLoadingInitialData && (isTokenError || !tokenData?.token)) {
          console.error("Failed to get Stream token or call ID is missing.");
          toast.error(
            "Failed to prepare for call. Please check your login and call link."
          );
          setHasError(true);
          setConnectionPhase("failed");
        }
        return;
      }

      if (client && call) return;

      setConnectionPhase("initial");

      slowTimeoutRef.current = setTimeout(() => {
        if (!client || !call) {
          setConnectionPhase("slow");
        }
      }, 5000);

      timeoutRef.current = setTimeout(() => {
        if (!client || !call) {
          setConnectionPhase("failed");
          setHasError(true);
          toast.error(
            "Connection timeout. Please check your internet connection."
          );
        }
      }, 60000);

      try {
        const videoClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: {
            id: user.id,
            name: user.fullName || user.id,
            image: user.imageUrl,
          },
          token: tokenData.token,
        });

        const callInstance = videoClient.call("default", callId);
        await callInstance.join({ create: true });

        setClient(videoClient);
        setCall(callInstance);
        setHasError(false);
        setConnectionPhase("connected");

        if (slowTimeoutRef.current) clearTimeout(slowTimeoutRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      } catch (error) {
        console.error("Error initializing Stream call:", error);
        toast.error(
          "Failed to connect to the video call. Please try refreshing."
        );
        setHasError(true);
        setConnectionPhase("failed");

        if (client) {
          client.disconnectUser();
        }
      }
    };

    initCall();

    return () => {
      if (slowTimeoutRef.current) clearTimeout(slowTimeoutRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (client) {
        client.disconnectUser();
        setClient(null);
        setCall(null);
        setHasError(false);
      }
    };
  }, [
    isLoadingInitialData,
    isTokenError,
    tokenData,
    user,
    callId,
    client,
    call,
  ]);

  // Error Screen (fixed broken JSX)
  const ErrorScreen = () => (
    <div className="error-container flex h-screen flex-col items-center justify-center p-4 relative overflow-hidden">
      <ThemeToggle toggle={toggleTheme} />

      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-2xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gray-500 rounded-full mix-blend-multiply filter blur-2xl animate-pulse animation-delay-2000"></div>
      </div>

      <div className="error-card w-full max-w-2xl rounded-2xl p-12 text-center shadow-2xl relative z-10 animate-fade-in-up">
        <div className="mx-auto w-20 h-20 text-red-400 mb-8">
          <svg
            className="w-full h-full animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="mb-6 text-4xl font-bold text-red-400 bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
          Connection Failed
        </h2>
        <p className="mb-8 text-xl leading-relaxed max-w-lg mx-auto opacity-80">
          We couldn't connect you to the video call. This might be due to a
          network issue, an invalid call link, or your login session expiring.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg transition-all duration-300 ease-in-out hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
          >
            Retry Call
          </button>

          <button
            onClick={() => window.history.back()}
            className="ml-4 inline-flex items-center px-8 py-4 text-lg font-semibold text-gray-300 bg-gray-700 bg-opacity-50 rounded-xl shadow-lg transition-all duration-300 ease-in-out hover:bg-gray-600 hover:shadow-xl transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-gray-500 focus:ring-opacity-50"
          >
            Go Back
          </button>
        </div>

        <p className="text-sm text-gray-400 mt-8">
          If the problem persists, please try again later or contact support.
        </p>
      </div>
    </div>
  );

  if (connectionPhase === "failed" || hasError) {
    return <ErrorScreen />;
  }

  if (
    connectionPhase === "initial" ||
    connectionPhase === "slow" ||
    isLoadingInitialData
  ) {
    return <div>Loading...</div>; // keep your LoadingScreen here if needed
  }

  return (
    <div className="call-page-container" onWheel={handleWheel}>
      <ThemeToggle toggle={toggleTheme} />
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <StreamTheme>
            <SpeakerLayout />
            <CallControls />
          </StreamTheme>
        </StreamCall>
      </StreamVideo>
    </div>
  );
};

const CallContent = () => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const navigate = useNavigate();

  useEffect(() => {
    if (callingState === CallingState.LEFT) {
      toast.success("You have successfully left the call.");
      navigate("/");
    }
  }, [callingState, navigate]);

  return null;
};

export default CallPage;
