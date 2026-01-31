"use client";

import { useState, useEffect, useRef } from "react";
import {
  IoCall,
  IoVideocam,
  IoMic,
  IoMicOff,
  IoVideocamOff,
  IoClose,
} from "react-icons/io5";
import Image from "next/image";

interface VideoCallModalProps {
  isOpen: boolean;
  callType: "audio" | "video";
  isIncoming: boolean;
  callerName: string;
  callerAvatar: string | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callStatus: "idle" | "connecting" | "ringing" | "active" | "ended";
}

export default function VideoCallModal({
  isOpen,
  callType,
  isIncoming,
  callerName,
  callerAvatar,
  onAccept,
  onReject,
  onEnd,
  localStream,
  remoteStream,
  callStatus,
}: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Setup local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Setup remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (callStatus === "active") {
      const interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCallDuration(0);
    }
  }, [callStatus]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
      {/* Incoming Call Screen */}
      {isIncoming && callStatus === "ringing" && (
        <div className="text-center">
          <Image
            src={callerAvatar || "https://via.placeholder.com/120"}
            alt={callerName}
            width={120}
            height={120}
            className="rounded-full mx-auto mb-6 object-cover"
          />
          <h2 className="text-2xl font-bold text-white mb-2">{callerName}</h2>
          <p className="text-gray-400 mb-8">
            {callType === "video" ? "Video call..." : "Voice call..."}
          </p>
          <div className="flex gap-8 justify-center">
            <button
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            >
              <IoClose size={32} className="text-white" />
            </button>
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
            >
              {callType === "video" ? (
                <IoVideocam size={32} className="text-white" />
              ) : (
                <IoCall size={32} className="text-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Outgoing Call Screen */}
      {!isIncoming && callStatus === "connecting" && (
        <div className="text-center">
          <Image
            src={callerAvatar || "https://via.placeholder.com/120"}
            alt={callerName}
            width={120}
            height={120}
            className="rounded-full mx-auto mb-6 object-cover"
          />
          <h2 className="text-2xl font-bold text-white mb-2">{callerName}</h2>
          <p className="text-gray-400 mb-8">Calling...</p>
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors mx-auto"
          >
            <IoClose size={32} className="text-white" />
          </button>
        </div>
      )}

      {/* Active Call Screen */}
      {callStatus === "active" && (
        <div className="w-full h-full relative">
          {/* Remote Video (Full Screen) */}
          <div className="w-full h-full bg-gray-800">
            {callType === "video" && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Image
                    src={callerAvatar || "https://via.placeholder.com/120"}
                    alt={callerName}
                    width={120}
                    height={120}
                    className="rounded-full mx-auto mb-4 object-cover"
                  />
                  <h2 className="text-2xl font-bold text-white">
                    {callerName}
                  </h2>
                  <p className="text-gray-400 mt-2">
                    {formatDuration(callDuration)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Local Video (Picture-in-Picture) */}
          {callType === "video" && localStream && (
            <div className="absolute top-4 right-4 w-40 h-56 bg-gray-900 rounded-lg overflow-hidden shadow-lg">
              {!isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <IoVideocamOff size={48} className="text-gray-500" />
                </div>
              )}
            </div>
          )}

          {/* Call Controls */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="bg-gray-800/90 rounded-full px-6 py-4 flex gap-4 backdrop-blur-sm">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  isMuted
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {isMuted ? (
                  <IoMicOff size={24} className="text-white" />
                ) : (
                  <IoMic size={24} className="text-white" />
                )}
              </button>

              {/* End Call Button */}
              <button
                onClick={onEnd}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
              >
                <IoClose size={28} className="text-white" />
              </button>

              {/* Video Toggle Button */}
              {callType === "video" && (
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    isVideoOff
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  {isVideoOff ? (
                    <IoVideocamOff size={24} className="text-white" />
                  ) : (
                    <IoVideocam size={24} className="text-white" />
                  )}
                </button>
              )}
            </div>
            {/* Duration */}
            <p className="text-white text-center mt-4 font-medium">
              {formatDuration(callDuration)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
