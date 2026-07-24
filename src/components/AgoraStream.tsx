import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack, 
  IAgoraRTCRemoteUser 
} from "agora-rtc-sdk-ng";
import { Camera, Volume2, Radio, Activity } from "lucide-react";

// Disable default Agora console logging in production
AgoraRTC.setLogLevel(3);

interface AgoraStreamProps {
  channelName: string;
  role: "publisher" | "subscriber";
  muted?: boolean;
  videoMuted?: boolean;
  facingMode?: "user" | "environment";
  hostAvatar?: string;
  hostName?: string;
  onStatusChange?: (status: "idle" | "connecting" | "connected" | "error" | "simulated", details?: string) => void;
}

export const AgoraStream: React.FC<AgoraStreamProps> = ({
  channelName,
  role,
  muted = false,
  videoMuted = false,
  facingMode = "user",
  hostAvatar = "",
  hostName = "Streamer",
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
  
  // Cross-Device WebRTC P2P States
  const [remoteHostCameraMuted, setRemoteHostCameraMuted] = useState<boolean>(false);
  const [p2pConnected, setP2pConnected] = useState<boolean>(false);
  const peerConnectionsRef = useRef<{ [subId: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const subIdRef = useRef<string>("sub_" + Math.random().toString(36).substring(2, 9));
  const subPcRef = useRef<RTCPeerConnection | null>(null);

  // Separate sequence number refs for robust polling
  const hostSeqRef = useRef<number>(0);
  const subSeqRef = useRef<number>(0);
  const allSeqRef = useRef<number>(0);

  const videoMutedRef = useRef<boolean>(videoMuted);
  useEffect(() => {
    videoMutedRef.current = videoMuted;
  }, [videoMuted]);

  const mutedRef = useRef<boolean>(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // App Streaming Status
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "simulated">("idle");
  const [statusDetails, setStatusDetails] = useState<string>("Initializing...");

  // Fallback default avatar
  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80";
  const avatarUrl = hostAvatar && hostAvatar.trim().length > 0 ? hostAvatar : defaultAvatar;

  // Status callback
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status, statusDetails);
    }
  }, [status, statusDetails, onStatusChange]);

  // Handle local track mute / unmute updates for Publisher
  useEffect(() => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(!muted).catch(() => {});
    }
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !muted;
      });
    }
  }, [muted, localAudioTrack]);

  useEffect(() => {
    if (localVideoTrack) {
      localVideoTrack.setEnabled(!videoMuted).catch(() => {});
    }
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !videoMuted;
      });
    }
  }, [videoMuted, localVideoTrack]);

  // Main Streaming Engine Effect
  useEffect(() => {
    let activeClient: IAgoraRTCClient | null = null;
    let activeVideoTrack: ICameraVideoTrack | null = null;
    let activeAudioTrack: IMicrophoneAudioTrack | null = null;
    let isUnmounted = false;
    let bc: BroadcastChannel | null = null;
    let pollInterval: any = null;
    let stateInterval: any = null;

    const cleanChannel = String(channelName || "default_room").toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, "");

    const postSignal = (target: string, type: string, data?: any) => {
      if (isUnmounted) return;
      const fromId = role === "publisher" ? "host" : subIdRef.current;
      const payload = {
        type,
        target,
        from: fromId,
        sdp: data?.sdp,
        candidate: data?.candidate,
        subId: data?.subId || subIdRef.current,
        videoMuted: videoMutedRef.current,
        muted: mutedRef.current,
        avatarUrl,
        hostName,
        ...data
      };

      // 1. Send via local BroadcastChannel for same-browser multi-tab
      if (bc) {
        try {
          bc.postMessage(payload);
        } catch (e) {}
      }

      // 2. Send via Server HTTP Endpoint for Cross-Device WebRTC
      fetch("/api/v1/webrtc/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelName: cleanChannel,
          target,
          from: fromId,
          type,
          data: payload
        })
      }).catch(() => {});
    };

    const startStream = async () => {
      setStatus("connecting");
      setStatusDetails("Connecting to live channel...");

      // 1. Attempt Agora Token Retrieval
      let tokenData: any = null;
      const requestUid = Math.floor(Math.random() * 89999999) + 10000000;
      try {
        const token = localStorage.getItem("sehr_auth_token");
        const res = await fetch("/api/v1/agora/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ channelName: cleanChannel, role, uid: requestUid })
        });
        if (res.ok) {
          tokenData = await res.json();
        }
      } catch (err) {}

      // If Agora App ID is mock/unconfigured, run P2P WebRTC Direct Stream Engine
      if (!tokenData || tokenData.appId === "MOCK_AGORA_APP_ID" || (tokenData.token && tokenData.token.startsWith("mock-"))) {
        startP2pStream();
        return;
      }

      // 2. Real Agora Production Connection
      try {
        setStatusDetails("Connecting to Agora WebRTC...");
        const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        activeClient = agoraClient;
        setClient(agoraClient);

        const targetStreamUid = tokenData.uid || requestUid;
        try {
          await agoraClient.join(tokenData.appId, tokenData.channelName, tokenData.token, targetStreamUid);
        } catch (joinErr: any) {
          const fallbackUid = Math.floor(Math.random() * 89999999) + 10000000;
          await agoraClient.join(tokenData.appId, tokenData.channelName, tokenData.token, fallbackUid);
        }

        if (isUnmounted) return;

        if (role === "publisher") {
          try {
            const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
              { encoderConfig: "music_standard" },
              { encoderConfig: "720p_1" }
            );

            if (isUnmounted) {
              audioTrack.close();
              videoTrack.close();
              return;
            }

            activeAudioTrack = audioTrack;
            activeVideoTrack = videoTrack;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);

            if (mutedRef.current) await audioTrack.setEnabled(false);
            if (videoMutedRef.current) await videoTrack.setEnabled(false);

            if (containerRef.current) {
              containerRef.current.innerHTML = "";
              videoTrack.play(containerRef.current, { fit: "cover" });
            }

            await agoraClient.publish([audioTrack, videoTrack]);
            setStatus("connected");
            setStatusDetails("Streaming LIVE to server");
          } catch (deviceErr) {
            startP2pStream();
          }
        } else {
          // SUBSCRIBER MODE (Agora SDK)
          const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
            if (isUnmounted) return;
            await agoraClient.subscribe(user, mediaType);
            if (isUnmounted) return;

            if (mediaType === "video" && user.videoTrack) {
              setRemoteUser(user);
              setHasRemoteVideo(true);
              if (containerRef.current) {
                containerRef.current.innerHTML = "";
                user.videoTrack.play(containerRef.current, { fit: "cover" });
              }
              setStatus("connected");
              setStatusDetails("Connected to Broadcaster Stream");
            }

            if (mediaType === "audio" && user.audioTrack) {
              try {
                await user.audioTrack.play();
                setAudioBlocked(false);
              } catch (playErr) {
                setAudioBlocked(true);
              }
            }
          };

          const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
            if (mediaType === "video") {
              setHasRemoteVideo(false);
              if (containerRef.current) containerRef.current.innerHTML = "";
            }
          };

          agoraClient.on("user-published", handleUserPublished);
          agoraClient.on("user-unpublished", handleUserUnpublished);

          for (const user of agoraClient.remoteUsers) {
            if (user.hasVideo) await handleUserPublished(user, "video");
            if (user.hasAudio) await handleUserPublished(user, "audio");
          }

          if (agoraClient.remoteUsers.length === 0) {
            startP2pStream();
          }
        }
      } catch (err) {
        startP2pStream();
      }
    };

    // 3. WebRTC Direct Cross-Device & P2P Stream Engine
    const startP2pStream = async () => {
      if (isUnmounted) return;
      const channelKey = `sehr_webrtc_v5_${cleanChannel}`;
      bc = new BroadcastChannel(channelKey);

      const iceServers = [
        { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] }
      ];

      if (role === "publisher") {
        setStatusDetails("Starting camera & microphone...");
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode }, 
            audio: true 
          });
        } catch (err) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (e2) {
            console.warn("[P2P] Camera access failed, continuing in fallback mode");
          }
        }

        if (isUnmounted) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (stream) {
          localStreamRef.current = stream;
          stream.getVideoTracks().forEach(t => t.enabled = !videoMutedRef.current);
          stream.getAudioTracks().forEach(t => t.enabled = !mutedRef.current);

          if (containerRef.current) {
            containerRef.current.innerHTML = "";
            const videoEl = document.createElement("video");
            videoEl.srcObject = stream;
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = true; // Host suppresses local audio feedback
            videoEl.className = `w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`;
            containerRef.current.appendChild(videoEl);
          }
        }

        setStatus("connected");
        setStatusDetails("Live Camera Active");

        // Broadcast host state continuously to all viewers
        const sendHostState = () => {
          postSignal("all", "HOST_STATE");
        };
        sendHostState();
        stateInterval = setInterval(sendHostState, 1000);

        // Handle incoming subscriber signals (OFFER / ANSWER / ICE / JOIN)
        const processIncomingSignal = async (signalData: any) => {
          if (!signalData) return;
          const { type, from, sdp, candidate, subId, forceReconnect } = signalData;
          const subscriberId = subId || from;

          if (type === "SUBSCRIBER_JOIN" && subscriberId && stream) {
            let pc = peerConnectionsRef.current[subscriberId];
            const isClosedOrFailed = !pc || forceReconnect || pc.signalingState === "closed" || pc.connectionState === "failed" || pc.connectionState === "disconnected";
            
            if (isClosedOrFailed) {
              if (pc) {
                try { pc.close(); } catch (e) {}
              }
              pc = new RTCPeerConnection({ iceServers });
              peerConnectionsRef.current[subscriberId] = pc;

              stream.getTracks().forEach(track => {
                try { pc!.addTrack(track, stream!); } catch (e) {}
              });

              pc.onicecandidate = (e) => {
                if (e.candidate) {
                  postSignal(subscriberId, "ICE_CANDIDATE", { candidate: e.candidate, subId: subscriberId });
                }
              };

              pc.onconnectionstatechange = () => {
                if (pc?.connectionState === "failed" || pc?.connectionState === "closed") {
                  delete peerConnectionsRef.current[subscriberId];
                }
              };

              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                postSignal(subscriberId, "OFFER", { sdp: offer, subId: subscriberId });
              } catch (e) {
                console.error("[P2P HOST] Error creating offer:", e);
              }
            }
          } else if (type === "ANSWER" && subscriberId) {
            const pc = peerConnectionsRef.current[subscriberId];
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {});
            }
          } else if (type === "ICE_CANDIDATE" && subscriberId) {
            const pc = peerConnectionsRef.current[subscriberId];
            if (pc && candidate && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
          }
        };

        if (bc) {
          bc.onmessage = (msg) => processIncomingSignal(msg.data);
        }

        // Poll HTTP signaling endpoint for host
        pollInterval = setInterval(async () => {
          try {
            const res = await fetch(`/api/v1/webrtc/signals/${cleanChannel}/host?sinceSeq=${hostSeqRef.current}`);
            if (res.ok) {
              const body = await res.json();
              if (body.maxSeq) hostSeqRef.current = Math.max(hostSeqRef.current, body.maxSeq);
              if (Array.isArray(body.signals)) {
                body.signals.sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0));
                for (const s of body.signals) {
                  if (s.seq) hostSeqRef.current = Math.max(hostSeqRef.current, s.seq);
                  await processIncomingSignal(s.data);
                }
              }
            }
          } catch (e) {}
        }, 500);

      } else {
        // SUBSCRIBER (VIEWER) P2P MODE - NEVER PUBLISHES LOCAL CAMERA/MIC
        setStatusDetails("Connecting to Host live video feed...");

        const setupSubscriberPc = () => {
          if (subPcRef.current && subPcRef.current.connectionState === "connected") {
            return subPcRef.current; // Keep active connected stream intact
          }
          if (subPcRef.current && subPcRef.current.signalingState !== "closed") {
            try { subPcRef.current.close(); } catch (e) {}
          }
          
          const pc = new RTCPeerConnection({ iceServers });
          subPcRef.current = pc;

          pc.ontrack = (event) => {
            const stream = event.streams[0] || new MediaStream([event.track]);
            if (containerRef.current) {
              let videoEl = containerRef.current.querySelector("video") as HTMLVideoElement;
              if (!videoEl) {
                containerRef.current.innerHTML = "";
                videoEl = document.createElement("video");
                videoEl.autoplay = true;
                videoEl.playsInline = true;
                videoEl.muted = false; // UNMUTED REAL AUDIO FROM HOST
                videoEl.className = "w-full h-full object-cover";
                containerRef.current.appendChild(videoEl);
              }

              if (videoEl.srcObject !== stream) {
                videoEl.srcObject = stream;
              }

              videoEl.play().then(() => {
                setAudioBlocked(false);
              }).catch(() => {
                setAudioBlocked(true);
              });
            }

            setHasRemoteVideo(true);
            setP2pConnected(true);
            setStatus("connected");
            setStatusDetails("Connected to Broadcaster Stream");
          };

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              postSignal("host", "ICE_CANDIDATE", { candidate: e.candidate, subId: subIdRef.current });
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
              setP2pConnected(true);
              setStatus("connected");
              setStatusDetails("Connected to Broadcaster Stream");
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
              setP2pConnected(false);
              // Request immediate reconnection from Host
              postSignal("host", "SUBSCRIBER_JOIN", { subId: subIdRef.current, forceReconnect: true });
            }
          };

          return pc;
        };

        setupSubscriberPc();

        const processIncomingSubscriberSignal = async (signalData: any) => {
          if (!signalData) return;
          const { type, sdp, candidate, videoMuted: remoteCamMuted } = signalData;

          if (type === "HOST_STATE") {
            setRemoteHostCameraMuted(Boolean(remoteCamMuted));
          } else if (type === "OFFER") {
            const pc = setupSubscriberPc();
            if (pc && (pc.signalingState === "stable" || pc.signalingState === "have-local-offer" || pc.signalingState === "have-remote-offer")) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                postSignal("host", "ANSWER", { sdp: answer, subId: subIdRef.current });
              } catch (e) {
                console.error("[P2P SUB] Offer handle error:", e);
              }
            }
          } else if (type === "ICE_CANDIDATE") {
            const pc = subPcRef.current;
            if (pc && candidate && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
          }
        };

        if (bc) {
          bc.onmessage = (msg) => processIncomingSubscriberSignal(msg.data);
        }

        // Send JOIN message periodically ONLY UNTIL connected
        const sendJoin = () => {
          if (!subPcRef.current || subPcRef.current.connectionState !== "connected") {
            postSignal("host", "SUBSCRIBER_JOIN", { subId: subIdRef.current });
          }
        };
        sendJoin();
        stateInterval = setInterval(sendJoin, 1200);

        // Poll HTTP signaling server for host signals using separate sequence refs
        pollInterval = setInterval(async () => {
          try {
            const [resSub, resAll] = await Promise.all([
              fetch(`/api/v1/webrtc/signals/${cleanChannel}/${subIdRef.current}?sinceSeq=${subSeqRef.current}`),
              fetch(`/api/v1/webrtc/signals/${cleanChannel}/all?sinceSeq=${allSeqRef.current}`)
            ]);

            const subData = resSub.ok ? await resSub.json() : null;
            const allData = resAll.ok ? await resAll.json() : null;

            if (subData?.maxSeq) subSeqRef.current = Math.max(subSeqRef.current, subData.maxSeq);
            if (allData?.maxSeq) allSeqRef.current = Math.max(allSeqRef.current, allData.maxSeq);

            const subSignals = (subData?.signals || []).map((s: any) => ({ ...s, source: 'sub' }));
            const allSignals = (allData?.signals || []).map((s: any) => ({ ...s, source: 'all' }));
            const merged = [...subSignals, ...allSignals].sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0));

            for (const s of merged) {
              if (s.source === 'sub' && s.seq) subSeqRef.current = Math.max(subSeqRef.current, s.seq);
              if (s.source === 'all' && s.seq) allSeqRef.current = Math.max(allSeqRef.current, s.seq);
              await processIncomingSubscriberSignal(s.data);
            }
          } catch (e) {}
        }, 500);
      }
    };

    startStream();

    return () => {
      isUnmounted = true;
      if (pollInterval) clearInterval(pollInterval);
      if (stateInterval) clearInterval(stateInterval);
      if (bc) bc.close();
      if (activeVideoTrack) {
        activeVideoTrack.stop();
        activeVideoTrack.close();
      }
      if (activeAudioTrack) {
        activeAudioTrack.stop();
        activeAudioTrack.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (subPcRef.current) {
        try { subPcRef.current.close(); } catch (e) {}
        subPcRef.current = null;
      }
      Object.values(peerConnectionsRef.current).forEach((p: RTCPeerConnection) => {
        try { p.close(); } catch (e) {}
      });
      peerConnectionsRef.current = {};
      if (activeClient) {
        activeClient.leave().catch(() => {});
      }
    };
  }, [channelName, role, facingMode]);

  // Determine if Camera is turned off (Host toggles off OR subscriber receives camera off signal)
  const isCameraOff = role === "publisher" 
    ? Boolean(videoMuted) 
    : Boolean(videoMuted || remoteHostCameraMuted);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0814] flex items-center justify-center select-none">
      {/* 1. WEBRTC VIDEO STREAM CONTAINER */}
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
      {!isCameraOff && !hasRemoteVideo && role === "subscriber" && !p2pConnected && (
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

      {/* 4. UNMUTE AUDIO OVERLAY IF AUTOPLAY IS BLOCKED */}
      {audioBlocked && role === "subscriber" && (
        <button
          onClick={() => {
            const videoEl = containerRef.current?.querySelector("video");
            if (videoEl) {
              videoEl.play().then(() => setAudioBlocked(false)).catch(() => {});
            }
          }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-pink-600/90 hover:bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center space-x-2 border border-white/20 animate-bounce"
        >
          <Volume2 className="w-4 h-4" />
          <span>Tap screen to unmute live audio</span>
        </button>
      )}
    </div>
  );
};
