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
  private channel: ReturnType<typeof this.supabase.channel> | null = null;
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
    console.log("🔵 Starting call from", currentPetId, "to", remotePetId);

    // Subscribe to signals FIRST
    await this.subscribeToSignals(currentPetId);

    this.createPeerConnection();
    const stream = await this.getUserMedia(type);

    // Add local stream tracks to peer connection
    stream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, stream);
    });

    // Create offer
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    // Wait for receiver to signal ready, or timeout after 10 seconds
    console.log("🔵 Waiting for receiver to be ready...");
    const readyReceived = await this.waitForReceiverReady(10000);

    if (!readyReceived) {
      console.log("🔵 Receiver not ready after 10s, sending offer anyway...");
    }

    // Send call offer via Supabase
    console.log("🔵 Sending offer signal...");
    await this.sendSignal("offer", {
      offer,
      type,
      from: currentPetId,
      to: remotePetId,
    });
    console.log("🔵 Offer sent successfully");

    return stream;
  }

  // Wait for receiver ready signal
  private waitForReceiverReady(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);

      const handleReady = (payload: any) => {
        if (payload.type === "receiver-ready") {
          console.log("🔵 Receiver is ready!");
          clearTimeout(timer);
          resolve(true);
        }
      };

      this.channel?.on("broadcast", { event: "*" }, handleReady).subscribe();
    });
  }

  // Accept a call
  async acceptCall(
    type: CallType,
    remotePetId: string,
    currentPetId: string,
  ): Promise<MediaStream> {
    console.log("🟢 Accepting call, setting up peer connection...");

    // Ensure peer connection exists
    if (!this.peerConnection) {
      console.log("🟢 Creating peer connection for incoming call");
      await this.subscribeToSignals(currentPetId);
      this.createPeerConnection();
    }

    // Get user media first
    console.log("🟢 Requesting media permissions...");
    const stream = await this.getUserMedia(type);
    console.log("🟢 Media stream acquired");

    // Add local stream tracks to peer connection
    stream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, stream);
    });

    // Create and send answer after adding tracks
    console.log("🟢 Creating answer...");
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    console.log("🟢 Sending answer signal...");
    await this.sendSignal("answer", {
      answer,
      from: currentPetId,
      to: remotePetId,
    });

    return stream;
  }

  // Handle incoming offer
  async handleOffer(offer: RTCSessionDescriptionInit, currentPetId: string) {
    // Subscribe to signals FIRST
    await this.subscribeToSignals(currentPetId);

    this.createPeerConnection();

    await this.peerConnection!.setRemoteDescription(
      new RTCSessionDescription(offer),
    );
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
    if (!this.channel) {
      console.error("❌ Channel not initialized for sending signal");
      return;
    }
    console.log(
      `🔵 Sending signal: ${event} on channel: ${this.channelName}`,
      payload,
    );
    const result = await this.channel.send({
      type: "broadcast",
      event,
      payload,
    });
    console.log(`🔵 Signal send result:`, result);
  }

  // Public method to send receiver-ready signal
  async sendReceiverReady(currentPetId: string) {
    console.log("🟢 Sending receiver-ready signal to caller");
    await this.sendSignal("receiver-ready", {
      from: currentPetId,
    });
  }

  // Subscribe to signaling messages
  async subscribeToSignals(currentPetId: string) {
    if (this.channel) {
      // Already subscribed
      console.log("🔵 Channel already exists");
      return;
    }

    console.log(`🔵 Creating channel: ${this.channelName}`);
    this.channel = this.supabase.channel(this.channelName);

    this.channel
      .on("broadcast", { event: "answer" }, async (payload: any) => {
        console.log("🔵 Received answer event:", payload);
        if (payload.payload.to === currentPetId) {
          await this.handleAnswer(payload.payload.answer);
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async (payload: any) => {
        console.log("🔵 Received ICE candidate");
        await this.handleIceCandidate(payload.payload.candidate);
      })
      .on("broadcast", { event: "call-rejected" }, () => {
        console.log("🔵 Call rejected");
        if (this.onCallEndCallback) {
          this.onCallEndCallback();
        }
      })
      .on("broadcast", { event: "call-end" }, () => {
        console.log("🔵 Call ended");
        if (this.onCallEndCallback) {
          this.onCallEndCallback();
        }
      })
      .subscribe((status) => {
        console.log(`🔵 Channel subscription status:`, status);
      });

    // Wait a bit for subscription to be ready
    console.log("🔵 Waiting 500ms for channel to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log("🔵 Channel should be ready now");
  }

  // Send rejection signal
  async sendRejectSignal() {
    await this.sendSignal("call-rejected", {});
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
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
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
