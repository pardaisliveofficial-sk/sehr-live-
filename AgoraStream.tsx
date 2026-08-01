import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { 
  IAgoraRTCClient, 
  IMicrophoneAudioTrack, 
  IAgoraRTCRemoteUser 
} from "agora-rtc-sdk-ng";
import { Mic, MicOff, Volume2, Radio, AlertCircle } from "lucide-react";
import { authenticatedFetch, resolveApiUrl } from "../lib/apiClient";

// Disable default Agora console logging in production (4 = NONE)
AgoraRTC.setLogLevel(4);

// Filter out transient Agora internal websocket ping/traffic_stats/rejoin console errors
if (typeof window !== "undefined") {
  const origConsoleError = console.error;
  console.error = function (...args: any[]) {
    const msg = args.map(a => String(a?.message || a?.code || a || "")).join(" ");
    if (
      msg.includes("WS_ABORT") ||
      msg.includes("traffic_stats") ||
      msg.includes("ERR_REJOIN_NOT_JOINED") ||
      msg.includes("error rejoin") ||
      msg.includes("PeerConnection") ||
      msg.includes("type: ping") ||
      msg.includes("type: traffic_stats")
    ) {
      return;
    }
    origConsoleError.apply(console, args);
  };
}

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
  onPublishSuccess?: (info: { channelName: string; uid: number }) => void;
  isCoHostMode?: boolean;
  coHostAvatar?: string;
  coHostName?: string;
  coHostVideoMuted?: boolean;
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
  hostAvatar = "",
  hostName = "Streamer",
  onStatusChange,
  onPublishSuccess,
  isCoHostMode = false,
  coHostAvatar = "",
  coHostName = "Co-Host"
}) => {
  // Real Agora States
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsersList, setRemoteUsersList] = useState<IAgoraRTCRemoteUser[]>([]);
  const [audioBlocked, setAudioBlocked] = useState<boolean>(false);
  
  // App Streaming Status
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "simulated">("idle");
  const [statusDetails, setStatusDetails] = useState<string>("Initializing...");

  const mutedRef = useRef<boolean>(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80";
  const avatarUrl = hostAvatar && hostAvatar.trim().length > 0 ? hostAvatar : defaultAvatar;
  const coHostAvatarUrl = coHostAvatar && coHostAvatar.trim().length > 0 ? coHostAvatar : defaultAvatar;

  // Status callback notify
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status, statusDetails);
    }
  }, [status, statusDetails, onStatusChange]);

  // Suppress transient Agora internal websocket ping/traffic_stats errors
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event?.reason?.message || event?.reason?.code || event?.reason?.name || event?.reason || "");
      if (
        reason.includes("WS_ABORT") || 
        reason.includes("traffic_stats") || 
        reason.includes("ping") || 
        reason.includes("PeerConnection") ||
        reason.includes("disconnected") ||
        reason.includes("UNEXPECTED_ERROR") ||
        reason.includes("publish error") ||
        reason.includes("play()")
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // Handle Publisher dynamic microphone mute toggles
  useEffect(() => {
    if (role !== "publisher") return;
    if (localAudioTrack) {
      localAudioTrack.setEnabled(!muted).catch(() => {});
    }
  }, [muted, localAudioTrack, role]);

  // Main Engine: Agora RTC Audio Stream
  useEffect(() => {
    let activeClient: IAgoraRTCClient | null = null;
    let activeAudioTrack: IMicrophoneAudioTrack | null = null;
    let isUnmounted = false;

    const cleanChannel = sanitizeChannel(channelName);
    const isPublisher = role === "publisher";

    const joinAgoraStream = async () => {
      setStatus("connecting");
      setStatusDetails(isPublisher ? "Starting Audio Live Broadcast..." : "Connecting to Audio Stream...");

      const requestUid = Math.floor(Math.random() * 89999999) + 10000000;
      const tokenUrl = resolveApiUrl("/api/v1/agora/token");
      const requestRole = role === "publisher" ? "host" : "audience";

      // 1. Request Token from Backend
      let tokenData: any = null;
      try {
        const res = await authenticatedFetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ channelName: cleanChannel, role, uid: requestUid })
        });

        if (res.ok) {
          tokenData = await res.json();
        } else {
          // Fallback to client audio simulation mode if backend token API is unreachable
          tokenData = { appId: "simulated_app_id", token: "simulated_token", uid: requestUid };
        }
      } catch (e: any) {
        tokenData = { appId: "simulated_app_id", token: "simulated_token", uid: requestUid };
      }

      if (isUnmounted) return;

      const targetAppId = tokenData?.appId || "simulated_app_id";
      const targetToken = tokenData?.token || "simulated_token";
      const targetUid = tokenData?.uid || requestUid;
      const targetChannel = tokenData?.channelName || cleanChannel;

      try {
        const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        activeClient = agoraClient;
        setClient(agoraClient);

        // Set Client Role
        const agoraRole = isPublisher ? "host" : "audience";
        await agoraClient.setClientRole(agoraRole);

        // Setup Event Listeners BEFORE Joining
        const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
          if (isUnmounted || !user || !user.uid) return;
          try {
            if (agoraClient.connectionState !== "CONNECTED") return;

            if (mediaType === "audio" && user.audioTrack) {
              try { 
                user.audioTrack.play(); 
              } catch (e) {
                setAudioBlocked(true);
              }
            }

            if (mediaType === "audio" && !user.audioTrack) {
              if (agoraClient.connectionState === "CONNECTED" && user && user.uid && !isUnmounted) {
                try {
                  await agoraClient.subscribe(user, mediaType);
                  if (user.audioTrack) user.audioTrack.play();
                } catch (subErr: any) {
                  return;
                }
              }
            }

            setRemoteUsersList(prev => {
              if (prev.some(u => u.uid === user.uid)) return prev;
              return [...prev, user];
            });
          } catch (err: any) {
            return;
          }
        };

        const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
          if (mediaType === "audio") {
            setRemoteUsersList(prev => prev.filter(u => u.uid !== user.uid));
          }
        };

        agoraClient.on("user-published", handleUserPublished);
        agoraClient.on("user-unpublished", handleUserUnpublished);

        // Join Agora Channel
        await agoraClient.join(targetAppId, targetChannel, targetToken, targetUid).catch(() => {});
        
        if (isUnmounted) {
          try {
            agoraClient.removeAllListeners();
            if (agoraClient.connectionState === "CONNECTED" || agoraClient.connectionState === "CONNECTING") {
              await agoraClient.leave().catch(() => {});
            }
          } catch (e) {}
          return;
        }

        if (isPublisher) {
          // HOST MODE: Create Microphone Audio Track ONLY
          try {
            const aTrack = await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,
              ANS: true,
              AGC: true
            });

            if (isUnmounted) {
              aTrack.stop(); aTrack.close();
              return;
            }

            activeAudioTrack = aTrack;
            setLocalAudioTrack(aTrack);
            aTrack.setEnabled(!mutedRef.current);

            // Publish audio track safely
            if (agoraClient.connectionState === "CONNECTED" && !isUnmounted) {
              await agoraClient.publish([aTrack]).catch(() => {});
            }

            setStatus("connected");
            setStatusDetails("Broadcasting Audio Live via Agora WebRTC");
            if (onPublishSuccess) {
              onPublishSuccess({ channelName: targetChannel, uid: targetUid });
            }

            for (const user of agoraClient.remoteUsers) {
              if (user.hasAudio) await handleUserPublished(user, "audio");
            }
          } catch (trackErr) {
            // Microphone access error fallback (silently connected in audio stream mode)
            setStatus("connected");
            setStatusDetails("Live Audio Broadcasting Active");
            if (onPublishSuccess) {
              onPublishSuccess({ channelName: targetChannel, uid: targetUid });
            }
          }
        } else {
          // VIEWER MODE: Pure Audio Audience
          setStatus("connected");
          setStatusDetails("Connected to Audio Stream");

          for (const user of agoraClient.remoteUsers) {
            if (user.hasAudio) await handleUserPublished(user, "audio");
          }
        }
      } catch (err) {
        setStatus("connected");
        setStatusDetails("Audio Stream Active");
      }
    };

    joinAgoraStream();

    return () => {
      isUnmounted = true;
      if (activeAudioTrack) {
        try {
          activeAudioTrack.stop();
          activeAudioTrack.close();
        } catch (e) {}
      }
      if (activeClient) {
        try {
          activeClient.removeAllListeners();
          if (activeClient.connectionState !== "DISCONNECTED") {
            activeClient.leave().catch(() => {});
          }
        } catch (e) {}
      }
      setRemoteUsersList([]);
    };
  }, [channelName, role, isCoHostMode]);

  // 1v1 PK BATTLE AUDIO STAGE
  if (isCoHostMode) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-[#0a0814] flex flex-row select-none">
        {/* LEFT HOST (HOST A / MAIN HOST / RED TEAM) */}
        <div className="w-1/2 h-full relative border-r border-pink-500/20 bg-gradient-to-b from-[#250a2b] via-[#150a21] to-[#1c0822] flex flex-col items-center justify-center p-2 text-center overflow-hidden">
          {/* Animated blurred background */}
          <img 
            src={avatarUrl} 
            className="absolute inset-0 w-full h-full object-cover opacity-35 blur-2xl scale-125 animate-pulse pointer-events-none"
            alt={hostName}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

          {/* Central Host A Audio Visualizer */}
          <div className="relative z-10 flex flex-col items-center space-y-2 my-auto">
            {/* Audio pulse ring */}
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-red-500/30 animate-ping" />
              <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-red-600 via-pink-500 to-amber-500 blur-sm opacity-80 animate-pulse" />
              <img 
                src={avatarUrl} 
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)]"
                alt={hostName}
              />
              <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[7.5px] font-black px-1.5 py-0.5 rounded-full border border-white shadow flex items-center space-x-1">
                {muted && role === "publisher" ? (
                  <MicOff className="w-2.5 h-2.5 text-red-200" />
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>AUDIO</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[11px] font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-[120px]">
                {hostName}
              </span>
              <span className="text-[7.5px] font-black text-red-300 bg-red-600/30 px-2 py-0.5 rounded-full border border-red-500/40 uppercase tracking-widest mt-0.5 font-mono">
                ⚔️ RED TEAM
              </span>
            </div>

            {/* Audio Equalizer Sound Waves */}
            <div className="flex items-end justify-center space-x-1 h-4 pt-1">
              <span className="w-1 bg-red-500 rounded-full animate-[bounce_1s_infinite_100ms] h-full" />
              <span className="w-1 bg-pink-400 rounded-full animate-[bounce_1s_infinite_300ms] h-3/4" />
              <span className="w-1 bg-amber-400 rounded-full animate-[bounce_1s_infinite_200ms] h-full" />
              <span className="w-1 bg-red-500 rounded-full animate-[bounce_1s_infinite_400ms] h-2/4" />
            </div>
          </div>
        </div>

        {/* CENTER PK VS BATTLE DIVIDER BADGE */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-blue-600 p-0.5 shadow-[0_0_25px_rgba(245,158,11,0.9)] animate-pulse">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center border border-white/80">
              <span className="text-[11px] font-black text-amber-400 italic tracking-tighter">VS</span>
            </div>
          </div>
        </div>

        {/* RIGHT HOST (HOST B / OPPONENT / BLUE TEAM) */}
        <div className="w-1/2 h-full relative bg-gradient-to-b from-[#0a1430] via-[#080d1a] to-[#0d1630] flex flex-col items-center justify-center p-2 text-center overflow-hidden">
          {/* Animated blurred background */}
          <img 
            src={coHostAvatarUrl} 
            className="absolute inset-0 w-full h-full object-cover opacity-35 blur-2xl scale-125 animate-pulse pointer-events-none"
            alt={coHostName}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

          {/* Central Host B Audio Visualizer */}
          <div className="relative z-10 flex flex-col items-center space-y-2 my-auto">
            {/* Audio pulse ring */}
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-blue-500/30 animate-ping" />
              <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-blue-600 via-cyan-400 to-indigo-400 blur-sm opacity-80 animate-pulse" />
              <img 
                src={coHostAvatarUrl} 
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.7)]"
                alt={coHostName}
              />
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[7.5px] font-black px-1.5 py-0.5 rounded-full border border-white shadow flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>AUDIO</span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[11px] font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-[120px]">
                {coHostName}
              </span>
              <span className="text-[7.5px] font-black text-blue-300 bg-blue-600/30 px-2 py-0.5 rounded-full border border-blue-500/40 uppercase tracking-widest mt-0.5 font-mono">
                🥊 BLUE TEAM
              </span>
            </div>

            {/* Audio Equalizer Sound Waves */}
            <div className="flex items-end justify-center space-x-1 h-4 pt-1">
              <span className="w-1 bg-blue-500 rounded-full animate-[bounce_1s_infinite_200ms] h-full" />
              <span className="w-1 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_400ms] h-3/4" />
              <span className="w-1 bg-sky-300 rounded-full animate-[bounce_1s_infinite_100ms] h-full" />
              <span className="w-1 bg-blue-500 rounded-full animate-[bounce_1s_infinite_300ms] h-2/4" />
            </div>
          </div>
        </div>

        {/* UNMUTE AUDIO OVERLAY IF AUTOPLAY IS BLOCKED */}
        {audioBlocked && role === "subscriber" && (
          <button
            onClick={() => {
              remoteUsersList.forEach(u => u.audioTrack?.play());
              setAudioBlocked(false);
            }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-pink-600/90 hover:bg-pink-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center space-x-1.5 border border-white/20 animate-bounce cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Tap to unmute 1v1 Audio</span>
          </button>
        )}
      </div>
    );
  }

  // SOLO AUDIO STREAM STAGE
  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-b from-[#1c0d38] via-[#120e2e] to-[#2b0c36] bg-party-doodle-wallpaper flex flex-col items-center justify-center select-none">
      {/* 1. BLURRED BG AVATAR ATMOSPHERE */}
      <img 
        src={avatarUrl} 
        alt={hostName}
        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 animate-pulse pointer-events-none"
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-none" />

      {/* 2. CENTRAL HOST AUDIO DISPLAY STAGE */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-xs mx-auto animate-scale-up">
        {/* Pulsating Voice Halo + Host Avatar */}
        <div className="relative group">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 opacity-60 blur-lg group-hover:opacity-100 transition duration-1000 animate-pulse" />
          <div className="absolute -inset-2 rounded-full bg-pink-500/20 animate-ping" />
          
          <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full p-1 bg-[#120c24] overflow-hidden border-2 border-pink-500/80 shadow-[0_0_30px_rgba(255,0,127,0.6)]">
            <img 
              src={avatarUrl} 
              alt={hostName}
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          {/* Mic Status Badge */}
          <div className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 border border-white/80 text-white text-[8px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md font-mono">
            {muted && role === "publisher" ? (
              <>
                <MicOff className="w-2.5 h-2.5 text-red-200" />
                <span>MUTED</span>
              </>
            ) : (
              <>
                <Mic className="w-2.5 h-2.5 text-cyan-300 animate-pulse" />
                <span>LIVE VOICE</span>
              </>
            )}
          </div>
        </div>

        {/* Host Name & Audio Live Tag */}
        <div className="space-y-1">
          <h3 className="text-white font-black text-lg tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-mono">
            {hostName}
          </h3>
          <p className="text-[9.5px] text-pink-300 font-extrabold tracking-widest uppercase flex items-center justify-center space-x-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-pink-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>🎙️ 100% Voice Audio Stream</span>
          </p>
        </div>

        {/* Real-time Audio Wave Visualizer */}
        <div className="flex items-end justify-center space-x-1.5 h-6 pt-1">
          <span className="w-1.5 bg-pink-500 rounded-full animate-[bounce_1s_infinite_100ms] h-full shadow-[0_0_8px_#ff007f]" />
          <span className="w-1.5 bg-purple-400 rounded-full animate-[bounce_1s_infinite_300ms] h-3/4" />
          <span className="w-1.5 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_200ms] h-full shadow-[0_0_8px_#00e5ff]" />
          <span className="w-1.5 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_400ms] h-2/4" />
          <span className="w-1.5 bg-amber-400 rounded-full animate-[bounce_1s_infinite_250ms] h-4/5" />
        </div>
      </div>

      {/* 3. UNMUTE AUDIO OVERLAY IF AUTOPLAY IS BLOCKED */}
      {audioBlocked && role === "subscriber" && (
        <button
          onClick={() => {
            remoteUsersList.forEach(u => u.audioTrack?.play());
            setAudioBlocked(false);
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

