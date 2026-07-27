import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack, 
  IAgoraRTCRemoteUser 
} from "agora-rtc-sdk-ng";
import { Camera, Volume2, Radio, AlertCircle } from "lucide-react";
import { authenticatedFetch, resolveApiUrl } from "../lib/apiClient";

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
  videoMuted = false,
  facingMode = "user",
  hostAvatar = "",
  hostName = "Streamer",
  publishCameraTrack,
  publishMicrophoneTrack,
  onStatusChange,
  onPublishSuccess,
  isCoHostMode = false,
  coHostAvatar = "",
  coHostName = "Co-Host",
  coHostVideoMuted = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  
  // Real Agora States
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsersList, setRemoteUsersList] = useState<IAgoraRTCRemoteUser[]>([]);
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
  const coHostAvatarUrl = coHostAvatar && coHostAvatar.trim().length > 0 ? coHostAvatar : defaultAvatar;

  const hasRemoteVideo = remoteUsersList.length > 0;

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
      const targetElem = isCoHostMode ? localContainerRef.current : containerRef.current;
      if (!videoMuted && targetElem) {
        localVideoTrack.play(targetElem);
      }
    }
  }, [videoMuted, localVideoTrack, role, isCoHostMode]);

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
      const tokenUrl = resolveApiUrl("/api/v1/agora/token");
      const requestRole = role === "publisher" ? "host" : "audience";

      // Diagnostic request log
      console.log(`[AGORA TOKEN REQUEST]\nURL: ${tokenUrl}\nchannelName: ${cleanChannel}\nuid: ${requestUid}\nrole: ${requestRole}`);

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
        } else if (res.status === 401) {
          if (!isUnmounted) {
            setStatus("error");
            setStatusDetails(`FAILED STEP: APP_AUTH\nHTTP STATUS: 401\nMESSAGE: User session expired or missing.`);
          }
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || res.statusText || "Token API error";
          if (!isUnmounted) {
            setStatus("error");
            setStatusDetails(`FAILED STEP: TOKEN_API\nHTTP STATUS: ${res.status}\nREQUEST URL: ${tokenUrl}\nMESSAGE: ${errMsg}`);
          }
          return;
        }
      } catch (e: any) {
        const errMsg = e.message || "Network request failed";
        if (!isUnmounted) {
          setStatus("error");
          setStatusDetails(`FAILED STEP: TOKEN_API\nHTTP STATUS: 0\nREQUEST URL: ${tokenUrl}\nMESSAGE: ${errMsg}`);
        }
        return;
      }

      if (isUnmounted) return;

      if (!tokenData || !tokenData.appId || !tokenData.token || !tokenData.uid) {
        if (!isUnmounted) {
          setStatus("error");
          setStatusDetails(`FAILED STEP: TOKEN_API\nHTTP STATUS: 200\nREQUEST URL: ${tokenUrl}\nMESSAGE: Server response missing required appId, token, or uid`);
        }
        return;
      }

      const targetAppId = tokenData.appId;
      const targetToken = tokenData.token;
      const targetUid = tokenData.uid;
      const targetChannel = tokenData.channelName || cleanChannel;

      try {
        const agoraClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        activeClient = agoraClient;
        setClient(agoraClient);

        // Set Client Role
        const agoraRole = isPublisher ? "host" : "audience";
        await agoraClient.setClientRole(agoraRole);

        agoraClient.on("exception", (event) => {
          if (event && (event.code === 2025 || String(event.msg || event.code || "").includes("REJOIN") || String(event.msg || event.code || "").includes("WS_ABORT") || String(event.msg || event.code || "").includes("ping") || String(event.msg || event.code || "").includes("PUBLISH") || String(event.msg || event.code || "").includes("traffic_stats") || String(event.msg || event.code || "").includes("restart_ice"))) {
            return;
          }
        });

        agoraClient.on("connection-state-change", (curState, prevState, reason) => {
          console.log(`[AGORA CONN STATE] ${prevState} -> ${curState}, reason: ${reason}`);
        });

        // Setup Event Listeners BEFORE Joining
        const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
          if (isUnmounted) return;
          try {
            if (agoraClient.connectionState !== "CONNECTED") return;

            if (mediaType === "audio" && user.audioTrack) {
              try { user.audioTrack.play(); } catch (e) {}
            }
            if (mediaType === "video" && user.videoTrack) {
              setRemoteUsersList(prev => {
                if (prev.some(u => u.uid === user.uid)) return prev;
                return [...prev, user];
              });
            }

            if ((mediaType === "video" && !user.videoTrack) || (mediaType === "audio" && !user.audioTrack)) {
              if (agoraClient.connectionState === "CONNECTED") {
                await agoraClient.subscribe(user, mediaType);
              }
            }
            
            if (isUnmounted || agoraClient.connectionState !== "CONNECTED") return;

            if (mediaType === "video" && user.videoTrack) {
              setRemoteUsersList(prev => {
                if (prev.some(u => u.uid === user.uid)) return prev;
                return [...prev, user];
              });
            }
            if (mediaType === "audio" && user.audioTrack) {
              try {
                user.audioTrack.play();
              } catch (e) {}
            }
          } catch (err: any) {
            if (
              err?.code === "INVALID_OPERATION" ||
              err?.code === "WS_ABORT" ||
              String(err?.message || err).includes("disconnected") ||
              String(err?.message || err).includes("not published") ||
              String(err?.message || err).includes("WS_ABORT") ||
              String(err?.name || err).includes("INVALID_OPERATION") ||
              String(err?.name || err).includes("WS_ABORT")
            ) {
              // Ignore transient Agora race conditions when subscribing/disconnecting
              return;
            }
            console.warn("[AGORA REMOTE SUBSCRIBE WARN]", err);
          }
        };

        const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
          console.log("[AGORA USER UNPUBLISHED]", { remoteUid: user.uid, mediaType });
          if (mediaType === "video") {
            setRemoteUsersList(prev => prev.filter(u => u.uid !== user.uid));
          }
        };

        agoraClient.on("user-published", handleUserPublished);
        agoraClient.on("user-unpublished", handleUserUnpublished);

        // Join Agora Channel
        await agoraClient.join(targetAppId, targetChannel, targetToken, targetUid);
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

            const targetElem = isCoHostMode ? localContainerRef.current : containerRef.current;
            if (targetElem && !videoMutedRef.current) {
              vTrack.play(targetElem);
            }

            // Publish tracks safely
            try {
              const alreadyPublishedVideo = agoraClient.localTracks.some(t => t.trackMediaType === "video");
              const alreadyPublishedAudio = agoraClient.localTracks.some(t => t.trackMediaType === "audio");
              const tracksToPub = [];
              if (!alreadyPublishedAudio && aTrack) tracksToPub.push(aTrack);
              if (!alreadyPublishedVideo && vTrack) tracksToPub.push(vTrack);

              if (tracksToPub.length > 0) {
                await agoraClient.publish(tracksToPub);
              }
            } catch (pubError: any) {
              console.log("[AGORA PUBLISH NOTICE]", pubError?.message || pubError);
            }

            setStatus("connected");
            setStatusDetails("Broadcasting Live via Agora RTC");
            if (onPublishSuccess) {
              onPublishSuccess({ channelName: targetChannel, uid: targetUid });
            }

            // Check for existing remote users already in channel
            for (const user of agoraClient.remoteUsers) {
              if (user.hasVideo) await handleUserPublished(user, "video");
              if (user.hasAudio) await handleUserPublished(user, "audio");
            }
          } catch (trackErr) {
            console.error("[AGORA HOST TRACK CREATION ERROR]", trackErr);
            setStatus("error");
            setStatusDetails("Failed to capture local camera/mic");
          }
        } else {
          // VIEWER MODE: Pure Audience
          setStatus("connected");
          setStatusDetails("Connected to Live Stream");

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
          const connState = activeClient.connectionState as string;
          if (connState !== "DISCONNECTED") {
            activeClient.leave().catch(() => {});
          }
        } catch (e) {}
      }
      setRemoteUsersList([]);
    };
  }, [channelName, role, facingMode, isCoHostMode]);

  // Re-play video tracks when containers change or remoteUsersList updates
  useEffect(() => {
    if (role === "publisher") {
      if (localVideoTrack && !videoMuted) {
        const targetElem = isCoHostMode ? localContainerRef.current : containerRef.current;
        if (targetElem) {
          try {
            localVideoTrack.play(targetElem);
          } catch (e) {
            console.warn("[AGORA LOCAL TRACK PLAY WARN]", e);
          }
        }
      }
      if (isCoHostMode && remoteUsersList[0]?.videoTrack && !coHostVideoMuted) {
        if (remoteContainerRef.current) {
          try {
            remoteUsersList[0].videoTrack.play(remoteContainerRef.current);
          } catch (e) {
            console.warn("[AGORA REMOTE TRACK PLAY WARN]", e);
          }
        }
      }
    } else {
      // Subscriber
      if (isCoHostMode) {
        if (remoteUsersList[0]?.videoTrack && localContainerRef.current) {
          try {
            remoteUsersList[0].videoTrack.play(localContainerRef.current);
          } catch (e) {}
        }
        if (remoteUsersList[1]?.videoTrack && remoteContainerRef.current) {
          try {
            remoteUsersList[1].videoTrack.play(remoteContainerRef.current);
          } catch (e) {}
        }
      } else {
        if (remoteUsersList[0]?.videoTrack && containerRef.current) {
          try {
            remoteUsersList[0].videoTrack.play(containerRef.current);
          } catch (e) {}
        }
      }
    }
  }, [localVideoTrack, videoMuted, remoteUsersList, coHostVideoMuted, isCoHostMode, role]);

  const hasLeftVideo = role === "publisher" ? !videoMuted : Boolean(remoteUsersList[0]?.videoTrack || remoteUsersList[0]?.hasVideo);
  const hasRightVideo = role === "publisher" 
    ? Boolean(remoteUsersList[0]?.videoTrack || remoteUsersList[0]?.hasVideo) && !coHostVideoMuted
    : Boolean(remoteUsersList[1]?.videoTrack || remoteUsersList[1]?.hasVideo) && !coHostVideoMuted;

  if (isCoHostMode) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-[#0a0814] flex flex-row select-none">
        {/* LEFT HOST (HOST A / LOCAL PUBLISHER OR HOST A REMOTE) */}
        <div className="w-1/2 h-full relative border-r border-white/10 bg-[#120d22] flex items-center justify-center overflow-hidden">
          <div 
            ref={localContainerRef} 
            className="absolute inset-0 z-0 w-full h-full object-cover"
          />
          {!hasLeftVideo && (
            <div className="absolute inset-0 z-10 bg-[#120e24] flex flex-col items-center justify-center p-2 text-center overflow-hidden">
              <img 
                src={avatarUrl} 
                className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-125"
                alt={hostName}
              />
              <div className="relative z-10 flex flex-col items-center space-y-1.5">
                <img 
                  src={avatarUrl} 
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-pink-500/70 shadow-lg"
                  alt={hostName}
                />
                <span className="text-[10px] font-black text-white truncate max-w-[100px]">{hostName}</span>
                <span className="text-[7px] text-pink-300 font-bold bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30 uppercase">
                  📷 Cam Off
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT HOST (HOST B / REMOTE CO-HOST) */}
        <div className="w-1/2 h-full relative bg-[#0e1220] flex items-center justify-center overflow-hidden">
          <div 
            ref={remoteContainerRef} 
            className="absolute inset-0 z-0 w-full h-full object-cover"
          />
          {!hasRightVideo && (
            <div className="absolute inset-0 z-10 bg-[#0d1220] flex flex-col items-center justify-center p-2 text-center overflow-hidden">
              <img 
                src={coHostAvatarUrl} 
                className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-125"
                alt={coHostName}
              />
              <div className="relative z-10 flex flex-col items-center space-y-1.5">
                <img 
                  src={coHostAvatarUrl} 
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-blue-500/70 shadow-lg"
                  alt={coHostName}
                />
                <span className="text-[10px] font-black text-white truncate max-w-[100px]">{coHostName}</span>
                <span className="text-[7px] text-blue-300 font-bold bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30 uppercase">
                  📷 Cam Off
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ERROR DISPLAY */}
        {status === "error" && (
          <div className="absolute inset-0 z-30 bg-[#0d0918]/95 flex flex-col items-center justify-center p-4 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-red-500 animate-pulse" />
            <p className="text-sm font-bold text-white whitespace-pre-line">{statusDetails}</p>
            <button 
              onClick={() => setStatus("idle")}
              className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-md"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    );
  }

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
          <p className="text-sm font-bold text-white whitespace-pre-line">{statusDetails}</p>
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
