"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WebRTCManager, CallType } from "@/lib/webrtc";
import VideoCallModal from "@/components/messages/VideoCallModal";

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const callType = searchParams.get("type") as CallType;
  const isIncoming = searchParams.get("incoming") === "true";
  const remotePetId = searchParams.get("remotePetId") as string;
  const remotePetName = searchParams.get("remotePetName") as string;
  const remotePetAvatar = searchParams.get("remotePetAvatar") as string;
  const currentPetId = searchParams.get("currentPetId") as string;

  const supabase = createClient();
  const [callStatus, setCallStatus] = useState<
    "connecting" | "ringing" | "active" | "ended"
  >(isIncoming ? "ringing" : "connecting");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const broadcastChannel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Initialize broadcast channel for communication with parent window
    broadcastChannel.current = new BroadcastChannel(`call-${matchId}`);

    broadcastChannel.current.onmessage = (event) => {
      if (event.data.type === "END_CALL") {
        handleEndCall();
      }
    };

    // Initialize WebRTC
    initializeCall();

    // If outgoing call, start automatically after a small delay
    // This ensures the page is fully loaded and can request permissions
    if (!isIncoming) {
      setTimeout(() => {
        startCall();
      }, 500);
    }

    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = () => {
    if (!webrtcManagerRef.current) {
      webrtcManagerRef.current = new WebRTCManager(matchId);

      webrtcManagerRef.current.onRemoteStream((stream) => {
        setRemoteStream(stream);
      });

      webrtcManagerRef.current.onCallEnd(() => {
        handleEndCall();
      });
    }
  };

  const startCall = async () => {
    if (!webrtcManagerRef.current) return;

    try {
      // Request permissions first with better error handling
      console.log("Requesting media permissions for", callType);
      const stream = await webrtcManagerRef.current.startCall(
        callType,
        remotePetId,
        currentPetId,
      );
      console.log("Media stream acquired:", stream.getTracks());
      setLocalStream(stream);

      // Notify parent window that call started
      broadcastChannel.current?.postMessage({ type: "CALL_STARTED" });
    } catch (error: any) {
      console.error("Error starting call:", error);

      let errorMessage = "Could not access camera/microphone.";
      if (error.name === "NotAllowedError") {
        errorMessage =
          "Permission denied. Please allow camera/microphone access and try again.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No camera/microphone found. Please check your devices.";
      } else if (error.name === "NotReadableError") {
        errorMessage =
          "Camera/microphone is already in use by another application.";
      }

      alert(errorMessage);
      window.close();
    }
  };

  const acceptCall = async () => {
    if (!webrtcManagerRef.current) return;

    try {
      console.log("Accepting call and requesting media for", callType);
      const stream = await webrtcManagerRef.current.acceptCall(
        callType,
        remotePetId,
        currentPetId,
      );
      console.log("Media stream acquired:", stream.getTracks());
      setLocalStream(stream);
      setCallStatus("active");
      callStartTimeRef.current = Date.now();

      // Notify parent window that call was accepted
      broadcastChannel.current?.postMessage({ type: "CALL_ACCEPTED" });
    } catch (error: any) {
      console.error("Error accepting call:", error);

      let errorMessage = "Could not access camera/microphone.";
      if (error.name === "NotAllowedError") {
        errorMessage =
          "Permission denied. Please allow camera/microphone access in your browser settings and refresh.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No camera/microphone found. Please check your devices.";
      } else if (error.name === "NotReadableError") {
        errorMessage =
          "Camera/microphone is already in use by another application.";
      }

      alert(errorMessage);
      window.close();
    }
  };

  const rejectCall = async () => {
    if (webrtcManagerRef.current) {
      await webrtcManagerRef.current.sendRejectSignal();
    }

    // Notify parent window that call was rejected
    broadcastChannel.current?.postMessage({ type: "CALL_REJECTED" });

    cleanup();
    window.close();
  };

  const handleEndCall = async () => {
    // Calculate duration and save history
    let duration = 0;
    if (callStartTimeRef.current) {
      duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);

      if (duration > 0) {
        try {
          await fetch("/api/messages/call-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              matchId,
              callType,
              duration,
            }),
          });
        } catch (error) {
          console.error("Error saving call history:", error);
        }
      }
    }

    // Notify parent window that call ended
    broadcastChannel.current?.postMessage({
      type: "CALL_ENDED",
      duration,
    });

    cleanup();
    window.close();
  };

  const cleanup = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.endCall();
      webrtcManagerRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (broadcastChannel.current) {
      broadcastChannel.current.close();
    }
  };

  // Listen for answer event from WebRTC
  useEffect(() => {
    if (!isIncoming) {
      // For outgoing calls, listen for when call is answered
      const channel = supabase.channel(`call:${matchId}`);
      channel
        .on("broadcast", { event: "answer" }, (payload: any) => {
          if (payload.payload.to === currentPetId) {
            setCallStatus("active");
            callStartTimeRef.current = Date.now();
          }
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [isIncoming, matchId, currentPetId]);

  return (
    <VideoCallModal
      isOpen={true}
      callType={callType}
      isIncoming={isIncoming}
      callerName={remotePetName || "Unknown"}
      callerAvatar={remotePetAvatar || null}
      onAccept={acceptCall}
      onReject={rejectCall}
      onEnd={handleEndCall}
      localStream={localStream}
      remoteStream={remoteStream}
      callStatus={callStatus}
    />
  );
}
