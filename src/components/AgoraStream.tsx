import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack, 
  IAgoraRTCRemoteUser 
} from "agora-rtc-sdk-ng";
import { Camera, Volume2, Radio, AlertCircle } from "lucide-react";

// Disable default Agora console logging in production
AgoraRTC.setLogLevel(4);

interface AgoraStreamProps {
  channelName: string;
  role: "publisher" | "subscriber";
  userId?: string;
  muted?: boolean;
  videoMuted?: boolean;
  facingMode?: "user" | "environment";
  hostAvatar?: string;
  hostName?: string;
  publishCameraTrack?: boolean;
  publishMicrophoneTrack?: boolean;
  onStatusChange?: (status: "idle" | "connecting" | "connected" | "error" | "simulated", details?: string) => void;
}

const sanitizeChannel = (ch: string) => {
  if (!ch) return "room_default";
  let str = String(ch).trim().toLowerCase();
  str = str.replace(/^room_/, "").replace(/^h-/, "");
  return `room_${str.replace(/[^a-zA-Z0-9_-]/g, "")}`;
};

export const AgoraStream: React.FC<AgoraStreamProps> = ({
  channelName,
  role,
  userId,
  muted = false,
  videoMuted = false,
  facingMode = "user",
  hostAvatar = "",
  hostName = "Streamer",
  publishCameraTrack,
  publishMicrophoneTrack,
  onStatusChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Real Agora States
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
  const [audioBlocked, setAudioBlocked] = useState<boolean>(false);
  
  // App Streaming Status
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "simulated">("idle");
  const [statusDetails, setStatusDetails] = useState<string>("Initializing...");

  // Keep refs for mutable prop values
  const videoMutedRef = useRef<boolean>(videoMuted);
  useEffect(() => {
    videoMutedRef.current = videoMuted;
  }, [videoMuted]);

  const mutedRef = useRef<boolean>(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80";
  const avatarUrl = hostAvatar && hostAvatar.trim().length > 0 ? hostAvatar : defaultAvatar;

  // Camera off determination
  const isCameraOff = role === "publisher" 
    ? Boolean(videoMuted) 
    : Boolean(videoMuted || !hasRemoteVideo);

  // Status callback notify
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status, statusDetails);
    }
  }, [status, statusDetails, onStatusChange]);

  // Handle Publisher dynamic track state toggles (Camera / Mic)
  useEffect(() => {
    if (role !== "publisher") return;
    if (localAudioTrack) {
      localAudioTrack.setEnabled(!muted).catch(() => {});
    }
  }, [muted, localAudioTrack, role]);

  useEffect(() => {
    if (role !== "publisher") return;
    if (localVideoTrack) {
      localVideoTrack.setEnabled(!videoMuted).catch(() => {});
      if (!videoMuted && containerRef.current) {
        localVideoTrack.play(containerRef.current);
      }
    }
  }, [videoMuted, localVideoTrack, role]);

  // Main Single Engine: Agora RTC Stream
  useEffect(() => {
    let activeClient: IAgoraRTCClient | null = null;
    let activeVideoTrack: ICameraVideoTrack | null = null;
    let activeAudioTrack: IMicrophoneAudioTrack | null = null;
    let isUnmounted = false;

    const cleanChannel = sanitizeChannel(channelName);
    const isPublisher = role === "publisher";

    const joinAgoraStream = async () => {
      setStatus("connecting");
      setStatusDetails(isPublisher ? "Initializing broadcaster stream..." : "Connecting to live stream...");

      const requestUid = Math.floor(Math.random() * 89999999) + 10000000;

      // 1. Request Token from Backend
      let tokenData: any = null;
      try {
        const authToken = localStorage.getItem("sehr_auth_token");
        const res = await fetch("/api/v1/agora/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ channelName: cleanChannel, role, uid: requestUid })
        });
        if (res.ok) {
          tokenData = await res.json();
        }
      } catch (e) {
        console.error("[AGORA TOKEN ERROR]", e);
      }

      if (isUnmounted) return;

      // Validate Agora credentials
      if (!tokenData || !tokenData.appId || tokenData.appId === "MOCK_AGORA_APP_ID") {
        console.error("[AGORA ERROR] Invalid or missing Agora App Credentials.");
        setStatus("error");
        setStatusDetails("Agora RTC Service unavailable. Check server config.");
        return;
      }

      try {
        const agoraClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        activeClient = agoraClient;
        setClient(agoraClient);

        // Set Client Role
        const agoraRole = isPublisher ? "host" : "audience";
        await agoraClient.setClientRole(agoraRole);

        // Trace Log
        if (isPublisher) {
          console.log("[AGORA HOST JOIN]", {
            channel: cleanChannel,
            uid: tokenData.uid,
            role: "host",
            localCameraEnabled: !videoMutedRef.current,
            localMicEnabled: !mutedRef.current
          });
        } else {
          console.log("[AGORA VIEWER JOIN]", {
            channel: cleanChannel,
            uid: tokenData.uid,
            role: "audience"
          });
        }

        // Setup Event Listeners BEFORE Joining
        const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
          if (isUnmounted) return;
          try {
            const connState = agoraClient.connectionState as string;
            if (connState === "DISCONNECTED" || connState === "DISCONNECTING") return;

            console.log("[AGORA USER PUBLISHED]", { remoteUid: user.uid, mediaType });

            await agoraClient.subscribe(user, mediaType);
            
            const currState = agoraClient.connectionState as string;
            if (isUnmounted || currState === "DISCONNECTED" || currState === "DISCONNECTING") return;

            setRemoteUser(user);
            console.log("[AGORA SUBSCRIBED]", { remoteUid: user.uid, mediaType });

            if (mediaType === "video") {
              setHasRemoteVideo(true);
              if (containerRef.current) {
                user.videoTrack?.play(containerRef.current);
              }
            }
            if (mediaType === "audio") {
              user.audioTrack?.play();
              console.log("[AGORA AUDIO PLAY]", { remoteUid: user.uid });
            }
          } catch (err) {
            console.warn("[AGORA REMOTE SUBSCRIBE ERROR]", err);
          }
        };

        const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
          console.log("[AGORA USER UNPUBLISHED]", { remoteUid: user.uid, mediaType });
          if (mediaType === "video") {
            setHasRemoteVideo(false);
          }
        };

        agoraClient.on("user-published", handleUserPublished);
        agoraClient.on("user-unpublished", handleUserUnpublished);

        // Join Agora Channel
        await agoraClient.join(tokenData.appId, cleanChannel, tokenData.token, tokenData.uid);
        if (isUnmounted) return;

        if (isPublisher) {
          // HOST MODE: Create Local Mic & Camera Tracks
          try {
            const [aTrack, vTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
              {},
              { encoderConfig: "720p_1", facingMode: facingMode as any }
            );

            if (isUnmounted) {
              aTrack.stop(); aTrack.close();
              vTrack.stop(); vTrack.close();
              return;
            }

            activeAudioTrack = aTrack;
            activeVideoTrack = vTrack;
            setLocalAudioTrack(aTrack);
            setLocalVideoTrack(vTrack);

            aTrack.setEnabled(!mutedRef.current);
            vTrack.setEnabled(!videoMutedRef.current);

            if (containerRef.current && !videoMutedRef.current) {
              vTrack.play(containerRef.current);
            }

            // Publish tracks
            await agoraClient.publish([aTrack, vTrack]);
            setStatus("connected");
            setStatusDetails("Broadcasting Live via Agora RTC");
          } catch (trackErr) {
            console.error("[AGORA HOST TRACK CREATION ERROR]", trackErr);
            setStatus("error");
            setStatusDetails("Failed to capture local camera/mic");
          }
        } else {
          // VIEWER MODE: Pure Audience
          setStatus("connected");
          setStatusDetails("Connected to Live Stream");

          // Inspect existing remote users already broadcasting in the room
          for (const user of agoraClient.remoteUsers) {
            if (user.hasVideo) await handleUserPublished(user, "video");
            if (user.hasAudio) await handleUserPublished(user, "audio");
          }
        }
      } catch (err) {
        console.error("[AGORA RTC JOIN ERROR]", err);
        if (!isUnmounted) {
          setStatus("error");
          setStatusDetails("Connection to Agora RTC failed.");
        }
      }
    };

    joinAgoraStream();

    return () => {
      isUnmounted = true;
      console.log("[AGORA LEAVE CLEANUP]", { channel: cleanChannel, role });

      if (activeVideoTrack) {
        try {
          activeVideoTrack.stop();
          activeVideoTrack.close();
        } catch (e) {}
      }
      if (activeAudioTrack) {
        try {
          activeAudioTrack.stop();
          activeAudioTrack.close();
        } catch (e) {}
      }
      if (activeClient) {
        try {
          activeClient.removeAllListeners();
          activeClient.leave().catch(() => {});
        } catch (e) {}
      }
      setRemoteUser(null);
      setHasRemoteVideo(false);
    };
  }, [channelName, role, facingMode]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0814] flex items-center justify-center select-none">
      {/* 1. AGORA RTC VIDEO STREAM CONTAINER */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 z-0 w-full h-full"
        style={{ display: isCameraOff ? "none" : "block" }}
      />

      {/* 2. CAMERA OFF DISPLAY - SHOWS BROADCASTER PROFILE PICTURE DP */}
      {isCameraOff && (
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-[#1a122e] via-[#0f0a1c] to-[#181028] flex flex-col items-center justify-center p-4 overflow-hidden select-none animate-fade-in">
          {/* Blurred Background Avatar */}
          <img 
            src={avatarUrl} 
            alt={hostName}
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-25 scale-125"
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Central Host Profile Display */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-xs mx-auto animate-scale-up">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-70 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full p-1 bg-[#120c24] overflow-hidden border-2 border-white/20 shadow-2xl">
                <img 
                  src={avatarUrl} 
                  alt={hostName}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-red-600 border-2 border-[#120c24] flex items-center justify-center shadow-md">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-white font-bold text-lg tracking-wide drop-shadow-md">
                {hostName}
              </h3>
              <p className="text-xs text-pink-300/80 font-medium tracking-wider uppercase flex items-center justify-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                <span>Broadcaster turned off camera</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. HOST LIVE BROADCAST DISPLAY WHEN CAMERA IS ON BUT CONNECTING */}
      {!isCameraOff && !hasRemoteVideo && role === "subscriber" && status !== "error" && (
        <div className="absolute inset-0 z-10 bg-[#0d0918] flex flex-col items-center justify-center p-4 overflow-hidden select-none">
          {/* Live Host Screen Background */}
          <img 
            src={avatarUrl} 
            alt={hostName}
            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-20 scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#090710]/80 via-[#120f21]/90 to-[#090710]/95" />

          <div className="relative z-10 flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-purple-600 shadow-lg animate-spin-slow">
              <img 
                src={avatarUrl} 
                alt={hostName}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="flex items-center space-x-2 text-pink-400 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 animate-pulse text-pink-500" />
              <span>Connecting to Broadcaster Stream...</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. ERROR DISPLAY IF AGORA RTC FAILS */}
      {status === "error" && (
        <div className="absolute inset-0 z-30 bg-[#0d0918]/95 flex flex-col items-center justify-center p-4 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 animate-pulse" />
          <p className="text-sm font-bold text-white">{statusDetails}</p>
          <button 
            onClick={() => setStatus("idle")}
            className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-md"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 5. UNMUTE AUDIO OVERLAY IF AUTOPLAY IS BLOCKED */}
      {audioBlocked && role === "subscriber" && (
        <button
          onClick={() => {
            if (remoteUser && remoteUser.audioTrack) {
              remoteUser.audioTrack.play();
              setAudioBlocked(false);
            }
          }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-pink-600/90 hover:bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center space-x-2 border border-white/20 animate-bounce cursor-pointer"
        >
          <Volume2 className="w-4 h-4" />
          <span>Tap screen to unmute live audio</span>
        </button>
      )}
    </div>
  );
};
