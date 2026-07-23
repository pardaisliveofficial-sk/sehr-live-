import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser
} from "agora-rtc-sdk-ng";
import { Camera, Mic, Volume2 } from "lucide-react";

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

// Helper for unique client viewer session instance
const getSessionViewerId = (): string => {
  try {
    let id = sessionStorage.getItem("sehr_agora_session_uid");
    if (!id) {
      id = "v_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
      sessionStorage.setItem("sehr_agora_session_uid", id);
    }
    return id;
  } catch (e) {
    return "v_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
  }
};

// Deterministic numeric UID generator for Agora RTC
const getNumericUid = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 200000000) + 10000;
};

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
  const videoElemRef = useRef<HTMLVideoElement | null>(null);

  // Agora SDK Instances
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);

  // States
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "simulated">("idle");
  const [statusDetails, setStatusDetails] = useState<string>("Initializing...");

  // Global browser audio unlocker for mobile/Chrome media audio routing
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if ((AgoraRTC as any).getAudioContext) {
          const ctx = (AgoraRTC as any).getAudioContext();
          if (ctx && ctx.state === "suspended") {
            ctx.resume();
          }
        }
      } catch (e) {}
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("touchstart", unlockAudio, { passive: true });
    window.addEventListener("click", unlockAudio, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("click", unlockAudio);
    };
  }, []);

  // Update status callback
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status, statusDetails);
    }
  }, [status, statusDetails, onStatusChange]);

  // Handle dynamic mute / unmute of local microphone
  useEffect(() => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.setEnabled(!muted).catch(() => {});
    }
    if (videoElemRef.current && videoElemRef.current.srcObject) {
      const stream = videoElemRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(t => { t.enabled = !muted; });
    }
  }, [muted]);

  // Handle dynamic camera enable / disable
  useEffect(() => {
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.setEnabled(!videoMuted).catch(() => {});
    }
    if (videoElemRef.current && videoElemRef.current.srcObject) {
      const stream = videoElemRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(t => { t.enabled = !videoMuted; });
    }
  }, [videoMuted]);

  useEffect(() => {
    let isUnmounted = false;
    let localMediaStream: MediaStream | null = null;
    const peerConnections = new Map<string, RTCPeerConnection>();
    let subscriberPeer: RTCPeerConnection | null = null;

    const bc = new BroadcastChannel("sehr_live_webrtc_channel_" + channelName);
    const hostId = channelName.replace(/^room_/, "");

    const cleanUpWebRTC = () => {
      try {
        bc.close();
      } catch (e) {}
      peerConnections.forEach(pc => pc.close());
      peerConnections.clear();
      if (subscriberPeer) {
        subscriberPeer.close();
        subscriberPeer = null;
      }
      if (localMediaStream) {
        localMediaStream.getTracks().forEach(t => t.stop());
        localMediaStream = null;
      }
    };

    const cleanUpAgora = async () => {
      if (localAudioTrackRef.current) {
        try {
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current.close();
        } catch (e) {}
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        try {
          localVideoTrackRef.current.stop();
          localVideoTrackRef.current.close();
        } catch (e) {}
        localVideoTrackRef.current = null;
      }
      if (clientRef.current) {
        try {
          await clientRef.current.leave();
        } catch (e) {}
        clientRef.current = null;
      }
    };

    // ------------------------------------------------------------------
    // WEBRTC FALLBACK ENGINE
    // ------------------------------------------------------------------
    const startWebRTCFallback = () => {
      console.info("[AgoraStream] Initializing direct WebRTC media audio pipeline...");
      setStatus("connecting");
      setStatusDetails("Connecting WebRTC live media stream...");

      if (role === "publisher") {
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode === "environment" ? "environment" : "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        }).then((stream) => {
          if (isUnmounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          localMediaStream = stream;

          // Toggle mic/cam states
          stream.getAudioTracks().forEach(t => { t.enabled = !muted; });
          stream.getVideoTracks().forEach(t => { t.enabled = !videoMuted; });

          // Render local preview
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
            const v = document.createElement("video");
            v.srcObject = stream;
            v.autoplay = true;
            v.playsInline = true;
            v.muted = true; // Local host preview muted to prevent feedback loop
            v.className = "w-full h-full object-cover" + (facingMode === "user" ? " scale-x-[-1]" : "");
            containerRef.current.appendChild(v);
            videoElemRef.current = v;
          }

          setStatus("connected");
          setStatusDetails("REAL MEDIA AUDIO LIVE (Publisher)");

          const sendSignal = (viewerId: string, payload: any) => {
            bc.postMessage({ viewerId, ...payload });
            fetch(`/api/v1/hosts/${hostId}/webrtc/signal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ from: "host", to: viewerId, signal: payload })
            }).catch(() => {});
          };

          const createOfferForViewer = async (viewerId: string) => {
            if (peerConnections.has(viewerId)) {
              peerConnections.get(viewerId)?.close();
              peerConnections.delete(viewerId);
            }

            const pc = new RTCPeerConnection({
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
              ]
            });
            peerConnections.set(viewerId, pc);

            if (localMediaStream) {
              localMediaStream.getTracks().forEach(track => {
                pc.addTrack(track, localMediaStream!);
              });
            }

            pc.onicecandidate = (e) => {
              if (e.candidate) {
                sendSignal(viewerId, { type: "ICE_CANDIDATE", candidate: e.candidate, from: "host" });
              }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(viewerId, { type: "SDP_OFFER", offer, from: "host" });
          };

          const handleIncomingSignal = async (data: any) => {
            if (!data || !data.from || data.from === "host") return;
            const viewerId = data.from;
            const signal = data.signal || data;

            if (signal.type === "VIEWER_JOIN") {
              createOfferForViewer(viewerId);
            } else if (signal.type === "SDP_ANSWER" && signal.answer) {
              const pc = peerConnections.get(viewerId);
              if (pc && pc.signalingState !== "closed") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
              }
            } else if (signal.type === "ICE_CANDIDATE" && signal.candidate) {
              const pc = peerConnections.get(viewerId);
              if (pc && pc.signalingState !== "closed") {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              }
            }
          };

          bc.onmessage = (evt) => handleIncomingSignal(evt.data);

          const pollInterval = setInterval(() => {
            if (isUnmounted) return;
            fetch(`/api/v1/hosts/${hostId}/webrtc/signals?client_id=host`)
              .then(res => res.json())
              .then(resData => {
                if (Array.isArray(resData.signals)) {
                  resData.signals.forEach((s: any) => handleIncomingSignal(s));
                }
              })
              .catch(() => {});
          }, 800);

          return () => clearInterval(pollInterval);
        }).catch((err) => {
          console.warn("[AgoraStream] Mic/Cam access denied:", err);
          setStatus("simulated");
          setStatusDetails("Camera/Microphone permission denied.");
        });

      } else {
        // Subscriber Mode
        const viewerId = "viewer_" + Math.random().toString(36).substring(2, 9);
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ]
        });
        subscriberPeer = pc;

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            setHasRemoteVideo(true);
            setHasRemoteAudio(true);
            setStatus("connected");
            setStatusDetails("REAL MEDIA AUDIO LIVE (Subscriber)");

            if (containerRef.current) {
              containerRef.current.innerHTML = "";
              const v = document.createElement("video");
              v.srcObject = remoteStream;
              v.autoplay = true;
              v.playsInline = true;
              v.muted = muted; // Audio played through device media speaker when muted is false
              v.className = "w-full h-full object-cover";
              containerRef.current.appendChild(v);
              videoElemRef.current = v;
              v.play().catch(() => {});
            }
          }
        };

        const sendSignalToHost = (signalPayload: any) => {
          bc.postMessage({ from: viewerId, to: "host", signal: signalPayload });
          fetch(`/api/v1/hosts/${hostId}/webrtc/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: viewerId, to: "host", signal: signalPayload })
          }).catch(() => {});
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            sendSignalToHost({ type: "ICE_CANDIDATE", candidate: e.candidate, from: "viewer" });
          }
        };

        const handleIncomingSignal = async (data: any) => {
          const signal = data.signal || data;
          if (!signal || signal.from !== "host") return;

          if (signal.type === "SDP_OFFER" && signal.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignalToHost({ type: "SDP_ANSWER", answer, from: "viewer" });
          } else if (signal.type === "ICE_CANDIDATE" && signal.candidate) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          }
        };

        bc.onmessage = (evt) => handleIncomingSignal(evt.data);

        sendSignalToHost({ type: "VIEWER_JOIN", from: viewerId });

        const retryInterval = setInterval(() => {
          if (isUnmounted || pc.remoteDescription) return;
          sendSignalToHost({ type: "VIEWER_JOIN", from: viewerId });
        }, 2000);

        const pollInterval = setInterval(() => {
          if (isUnmounted) return;
          fetch(`/api/v1/hosts/${hostId}/webrtc/signals?client_id=${viewerId}`)
            .then(res => res.json())
            .then(resData => {
              if (Array.isArray(resData.signals)) {
                resData.signals.forEach((s: any) => handleIncomingSignal(s));
              }
            })
            .catch(() => {});
        }, 800);
      }
    };

    // ------------------------------------------------------------------
    // AGORA RTC SDK ENGINE
    // ------------------------------------------------------------------
    const initAgoraRTC = async () => {
      setStatus("connecting");
      setStatusDetails("Fetching secure stream tokens...");

      // Clean up any existing client first to avoid lingering connection conflicts
      await cleanUpAgora();

      // Always pass null so Agora dynamically allocates a unique, conflict-free 32-bit integer UID
      const targetUid: number | null = null;

      let tokenData: any = null;

      try {
        const token = localStorage.getItem("sehr_auth_token");
        const res = await fetch("/api/v1/agora/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            channelName,
            role: role === "publisher" ? "publisher" : "subscriber",
            uid: targetUid || 0
          })
        });

        if (res.ok) {
          tokenData = await res.json();
        }
      } catch (err) {
        console.warn("[AgoraStream] Token API call failed, using WebRTC fallback:", err);
      }

      // Check if real or mock Agora App ID
      if (!tokenData || tokenData.appId === "MOCK_AGORA_APP_ID" || (tokenData.token && tokenData.token.startsWith("mock-"))) {
        startWebRTCFallback();
        return;
      }

      try {
        setStatusDetails("Connecting to Agora RTC live Gateway...");
        let agoraClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = agoraClient;

        const agoraRole = role === "publisher" ? "host" : "audience";
        await agoraClient.setClientRole(agoraRole);

        try {
          await agoraClient.join(
            tokenData.appId,
            tokenData.channelName,
            tokenData.token || null,
            targetUid
          );
        } catch (joinErr: any) {
          console.warn("[AgoraStream] Primary join encounter, retrying with fresh client & dynamic UID:", joinErr?.message || joinErr);
          
          try {
            await agoraClient.leave();
          } catch (e) {}

          if (isUnmounted) return;

          // Re-create a fresh client instance because failed join puts client in invalid state
          const freshClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
          clientRef.current = freshClient;
          agoraClient = freshClient;

          await agoraClient.setClientRole(agoraRole);
          await agoraClient.join(
            tokenData.appId,
            tokenData.channelName,
            tokenData.token || null,
            null
          );
        }

        if (isUnmounted) return;

        setStatus("connected");
        setStatusDetails("REAL AGORA RTC LIVE ACTIVE");

        // Set up subscription listener for remote video/audio (for Viewers, Guests & PK Opponents)
        const handleUserPublished = async (remoteUser: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
          if (isUnmounted) return;
          try {
            await agoraClient.subscribe(remoteUser, mediaType);
            if (isUnmounted) return;

            if (mediaType === "audio") {
              setHasRemoteAudio(true);
              if (remoteUser.audioTrack) {
                remoteUser.audioTrack.setVolume(100);
                remoteUser.audioTrack.play(); // Plays through device media audio speaker
              }
            } else if (mediaType === "video") {
              setHasRemoteVideo(true);
              if (remoteUser.videoTrack && containerRef.current) {
                const mediaStreamTrack = remoteUser.videoTrack.getMediaStreamTrack();
                if (mediaStreamTrack) {
                  const remoteStream = new MediaStream([mediaStreamTrack]);
                  containerRef.current.innerHTML = "";
                  const v = document.createElement("video");
                  v.srcObject = remoteStream;
                  v.autoplay = true;
                  v.playsInline = true;
                  v.muted = muted;
                  v.className = "w-full h-full object-cover";
                  containerRef.current.appendChild(v);
                  videoElemRef.current = v;
                  v.play().catch(e => console.warn("Remote stream play error:", e));
                } else {
                  remoteUser.videoTrack.play(containerRef.current);
                }
              }
            }
          } catch (subErr) {
            console.error("[AgoraStream] Error subscribing to remote user track:", subErr);
          }
        };

        const handleUserUnpublished = (remoteUser: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
          if (mediaType === "video") {
            setHasRemoteVideo(false);
          }
        };

        agoraClient.on("user-published", handleUserPublished);
        agoraClient.on("user-unpublished", handleUserUnpublished);

        // Subscribe to existing participants
        for (const remoteUser of agoraClient.remoteUsers) {
          if (remoteUser.hasAudio) {
            handleUserPublished(remoteUser, "audio");
          }
          if (remoteUser.hasVideo) {
            handleUserPublished(remoteUser, "video");
          }
        }

        // Publisher setup
        if (role === "publisher") {
          // Verify camera & microphone permissions before mounting stream player
          let mediaStream: MediaStream | null = null;
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: facingMode === "environment" ? "environment" : "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: true
            });
          } catch (permErr: any) {
            console.warn("[AgoraStream] Camera/Microphone permission request failed:", permErr);
            setStatus("simulated");
            setStatusDetails("Camera permission denied. Please allow camera access.");
            return;
          }

          if (isUnmounted) {
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            return;
          }

          localMediaStream = mediaStream;

          // Sync initial audio/video track enabled state
          mediaStream.getAudioTracks().forEach(t => { t.enabled = !muted; });
          mediaStream.getVideoTracks().forEach(t => { t.enabled = !videoMuted; });

          // Render video element with stream object assigned to srcObject
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
            const v = document.createElement("video");
            v.srcObject = mediaStream;
            v.autoplay = true;
            v.playsInline = true;
            v.muted = true; // Local host preview muted to prevent audio feedback
            v.className = "w-full h-full object-cover" + (facingMode === "user" ? " scale-x-[-1]" : "");
            containerRef.current.appendChild(v);
            videoElemRef.current = v;
            v.play().catch(e => console.warn("[AgoraStream] Local video element play error:", e));
          }

          // Convert verified MediaStream tracks into Agora tracks
          const videoTrack = mediaStream.getVideoTracks()[0];
          const audioTrack = mediaStream.getAudioTracks()[0];

          if (videoTrack) {
            try {
              const customVidTrack = await AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoTrack });
              localVideoTrackRef.current = customVidTrack as any;
              await customVidTrack.setEnabled(!videoMuted);
            } catch (eVid) {
              console.warn("[AgoraStream] Custom video track creation error, falling back to createCameraVideoTrack:", eVid);
              try {
                const fallbackVid = await AgoraRTC.createCameraVideoTrack({
                  encoderConfig: "720p_1",
                  facingMode: facingMode === "environment" ? "environment" : "user"
                });
                localVideoTrackRef.current = fallbackVid;
                await fallbackVid.setEnabled(!videoMuted);
              } catch (e) {}
            }
          }

          if (audioTrack) {
            try {
              const customAudTrack = await AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioTrack });
              localAudioTrackRef.current = customAudTrack as any;
              await customAudTrack.setEnabled(!muted);
            } catch (eAud) {
              console.warn("[AgoraStream] Custom audio track creation error, falling back to createMicrophoneAudioTrack:", eAud);
              try {
                const fallbackAud = await AgoraRTC.createMicrophoneAudioTrack({
                  encoderConfig: "music_standard"
                });
                localAudioTrackRef.current = fallbackAud;
                await fallbackAud.setEnabled(!muted);
              } catch (e) {}
            }
          }

          const tracksToPublish = [localAudioTrackRef.current, localVideoTrackRef.current].filter(Boolean) as any[];
          if (tracksToPublish.length > 0 && agoraClient) {
            await agoraClient.publish(tracksToPublish);
          }
          setStatusDetails("AGORA LIVE BROADCASTING ACTIVE");
        }

      } catch (agoraErr) {
        console.warn("[AgoraStream] Agora connection error, switching to WebRTC pipeline:", agoraErr);
        startWebRTCFallback();
      }
    };

    initAgoraRTC();

    return () => {
      isUnmounted = true;
      cleanUpWebRTC();
      cleanUpAgora();
    };
  }, [channelName, role, facingMode]);

  const isCameraOff = (role === "publisher" && videoMuted) || (role === "subscriber" && !hasRemoteVideo);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0814] flex items-center justify-center select-none">
      {/* 1. WEBRTC / AGORA RTC VIDEO DISPLAY CANVAS */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 z-0 w-full h-full"
      />

      {/* 2. CAMERA OFF OR CONNECTING FALLBACK SCREEN */}
      {isCameraOff && (
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-[#181328] via-[#0d0918] to-[#181328] flex flex-col items-center justify-center p-4 overflow-hidden select-none">
          <img 
            src={hostAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"}
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-125 pointer-events-none"
            alt="Background"
          />
          <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
            <div className="relative">
              <img 
                src={hostAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"}
                className="w-24 h-24 rounded-full object-cover border-4 border-pink-500/70 shadow-2xl"
                alt={hostName}
              />
              <div className="absolute bottom-0 right-0 bg-gray-900/90 text-pink-400 p-1.5 rounded-full border border-pink-500/40 shadow">
                <Camera className="w-4 h-4 opacity-70" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">{hostName}</h4>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 tracking-widest uppercase animate-pulse">
                {role === "subscriber" ? "🎙️ Real Live Stream Connecting / Audio Active" : "📷 Camera Off / Audio Active"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
