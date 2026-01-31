import { createClient } from "@/lib/supabase/client";

export type CallType = "audio" | "video";
export type CallStatus = "idle" | "connecting" | "ringing" | "active" | "ended";

export interface CallState {
  status: CallStatus;
  type: CallType | null;
  isIncoming: boolean;
  remotePetId: string | null;
  remotePetName: string | null;
  remotePetAvatar: string | null;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private supabase = createClient();
  private channelName: string;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onCallEndCallback: (() => void) | null = null;

  constructor(matchId: string) {
    this.channelName = `call:${matchId}`;
  }

  // Initialize peer connection
  private createPeerConnection() {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal("ice-candidate", { candidate: event.candidate });
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      if (this.onRemoteStreamCallback && event.streams[0]) {
        this.onRemoteStreamCallback(event.streams[0]);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (
        this.peerConnection?.connectionState === "disconnected" ||
        this.peerConnection?.connectionState === "failed" ||
        this.peerConnection?.connectionState === "closed"
      ) {
        if (this.onCallEndCallback) {
          this.onCallEndCallback();
        }
      }
    };
  }

  // Get user media
  async getUserMedia(type: CallType): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video" ? { width: 1280, height: 720 } : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  }

  // Start a call
  async startCall(
    type: CallType,
    remotePetId: string,
    currentPetId: string,
  ): Promise<MediaStream> {
    this.createPeerConnection();
    const stream = await this.getUserMedia(type);

    // Add local stream tracks to peer connection
    stream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, stream);
    });

    // Create offer
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    // Send call offer via Supabase
    await this.sendSignal("offer", {
      offer,
      type,
      from: currentPetId,
      to: remotePetId,
    });

    // Subscribe to signals
    this.subscribeToSignals(currentPetId);

    return stream;
  }

  // Accept a call
  async acceptCall(type: CallType): Promise<MediaStream> {
    const stream = await this.getUserMedia(type);

    // Add local stream tracks to peer connection
    stream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, stream);
    });

    return stream;
  }

  // Handle incoming offer
  async handleOffer(offer: RTCSessionDescriptionInit, currentPetId: string) {
    this.createPeerConnection();

    await this.peerConnection!.setRemoteDescription(
      new RTCSessionDescription(offer),
    );

    // Subscribe to signals before creating answer
    this.subscribeToSignals(currentPetId);
  }

  // Send answer after accepting call
  async sendAnswer(remotePetId: string, currentPetId: string) {
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    await this.sendSignal("answer", {
      answer,
      from: currentPetId,
      to: remotePetId,
    });
  }

  // Handle answer
  async handleAnswer(answer: RTCSessionDescriptionInit) {
    await this.peerConnection!.setRemoteDescription(
      new RTCSessionDescription(answer),
    );
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      await this.peerConnection?.addIceCandidate(
        new RTCIceCandidate(candidate),
      );
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  }

  // Send signal via Supabase broadcast
  private async sendSignal(event: string, payload: any) {
    const channel = this.supabase.channel(this.channelName);
    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
  }

  // Subscribe to signaling messages
  subscribeToSignals(currentPetId: string) {
    const channel = this.supabase.channel(this.channelName);

    channel
      .on("broadcast", { event: "answer" }, async (payload: any) => {
        if (payload.payload.to === currentPetId) {
          await this.handleAnswer(payload.payload.answer);
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async (payload: any) => {
        await this.handleIceCandidate(payload.payload.candidate);
      })
      .on("broadcast", { event: "call-end" }, () => {
        if (this.onCallEndCallback) {
          this.onCallEndCallback();
        }
      })
      .subscribe();
  }

  // End call
  async endCall() {
    // Send end signal
    await this.sendSignal("call-end", {});

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Unsubscribe from channel
    this.supabase.channel(this.channelName).unsubscribe();
  }

  // Set callback for remote stream
  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  // Set callback for call end
  onCallEnd(callback: () => void) {
    this.onCallEndCallback = callback;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}
