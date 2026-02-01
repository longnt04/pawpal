"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  IoSend,
  IoImageOutline,
  IoClose,
  IoCall,
  IoVideocam,
} from "react-icons/io5";
import MessageBubble from "./MessageBubble";
import VideoCallModal from "./VideoCallModal";
import { createClient } from "@/lib/supabase/client";
import { WebRTCManager, CallType, CallStatus } from "@/lib/webrtc";

interface Message {
  id: string;
  content: string | null;
  image_url: string | null;
  sender_pet_id: string;
  reply_to_message_id: string | null;
  is_read: boolean;
  created_at: string;
  isOptimistic?: boolean;
  sender: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  replied_message?: {
    id: string;
    content: string | null;
    image_url: string | null;
    sender_pet_id: string;
    sender: {
      name: string;
    };
  } | null;
  reactions?: Array<{ user_id: string; reaction: string }>;
}

interface Match {
  matchId: string;
  otherPet: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

interface ChatWindowProps {
  match: Match | null;
  currentPetId: string;
}

export default function ChatWindow({ match, currentPetId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<
    Record<string, Array<{ user_id: string; reaction: string }>>
  >({});
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callType, setCallType] = useState<CallType | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const otherTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const reactionsChannelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const supabase = createClient();

  const MESSAGES_PER_PAGE = 30;

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (match) {
      loadMessages();
      loadReactions();
      markMessagesAsRead();
      subscribeToMessages();
      subscribeToReactions();
      subscribeToTyping();
      subscribeToCallSignals();
    }

    return () => {
      if (messagesChannelRef.current) {
        messagesChannelRef.current.unsubscribe();
        messagesChannelRef.current = null;
      }
      if (reactionsChannelRef.current) {
        reactionsChannelRef.current.unsubscribe();
        reactionsChannelRef.current = null;
      }
      if (typingChannelRef.current) {
        typingChannelRef.current.unsubscribe();
        typingChannelRef.current = null;
      }
      if (callChannelRef.current) {
        callChannelRef.current.unsubscribe();
        callChannelRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (otherTypingTimeoutRef.current) {
        clearTimeout(otherTypingTimeoutRef.current);
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      // End any active call
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.endCall();
        webrtcManagerRef.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [match]);

  const loadCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadReactions = async () => {
    if (!match) return;
    try {
      const response = await fetch(
        `/api/messages/reactions?matchId=${match.matchId}`,
      );
      const data = await response.json();
      if (data.reactions) {
        setReactions(data.reactions);
      }
    } catch (error) {
      console.error("Error loading reactions:", error);
    }
  };

  const loadMessages = async (before?: string) => {
    if (!match) return;

    try {
      const url = new URL(`/api/messages/list`, window.location.origin);
      url.searchParams.set("matchId", match.matchId);
      url.searchParams.set("limit", MESSAGES_PER_PAGE.toString());
      if (before) url.searchParams.set("before", before);

      const response = await fetch(url.toString());
      const data = await response.json();
      if (data.messages) {
        if (before) {
          // Load more - prepend to existing messages
          setMessages((prev) => [...data.messages, ...prev]);
          setHasMore(data.messages.length === MESSAGES_PER_PAGE);
        } else {
          // Initial load
          setMessages(data.messages);
          setHasMore(data.messages.length === MESSAGES_PER_PAGE);
          // Scroll instantly to bottom on initial load
          setTimeout(() => scrollToBottom(true), 100);
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;

    setIsLoadingMore(true);
    const oldestMessage = messages[0];
    await loadMessages(oldestMessage.created_at);
    setIsLoadingMore(false);
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Check if scrolled to top
    if (container.scrollTop < 100) {
      loadMoreMessages();
    }
  };

  const markMessagesAsRead = async () => {
    if (!match) return;

    try {
      await fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.matchId }),
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const subscribeToMessages = () => {
    if (!match) return;

    messagesChannelRef.current = supabase
      .channel(`messages:${match.matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${match.matchId}`,
        },
        async (payload) => {
          // Fetch full message with sender info
          const { data } = await supabase
            .from("messages")
            .select(
              `
              id,
              content,
              image_url,
              sender_pet_id,
              reply_to_message_id,
              is_read,
              created_at,
              sender:pets!messages_sender_pet_id_fkey(id, name, avatar_url)
            `,
            )
            .eq("id", payload.new.id)
            .single();

          if (data) {
            // Handle sender being an array
            const sender = Array.isArray(data.sender)
              ? data.sender[0]
              : data.sender;

            // Fetch replied message separately if exists
            let repliedMessage = null;
            if (data.reply_to_message_id) {
              const { data: repliedData } = await supabase
                .from("messages")
                .select(
                  `
                  id,
                  content,
                  image_url,
                  sender_pet_id,
                  sender:pets!messages_sender_pet_id_fkey(name)
                `,
                )
                .eq("id", data.reply_to_message_id)
                .single();

              if (repliedData) {
                repliedMessage = {
                  ...repliedData,
                  sender: Array.isArray(repliedData.sender)
                    ? repliedData.sender[0]
                    : repliedData.sender,
                };
              }
            }

            const message: Message = {
              ...data,
              sender,
              replied_message: repliedMessage,
            };

            setMessages((prev) => {
              // Check if message already exists
              if (prev.some((m) => m.id === message.id)) {
                return prev;
              }
              // Remove optimistic message if this is the real version
              // Optimistic messages have temp IDs and same content/sender
              const withoutOptimistic = prev.filter((m) => {
                if (!m.isOptimistic) return true;
                // Remove optimistic if it matches this message's content and sender
                return !(
                  m.sender_pet_id === message.sender_pet_id &&
                  m.content === message.content &&
                  m.image_url === message.image_url
                );
              });
              return [...withoutOptimistic, message];
            });

            // Scroll to bottom to show new message (smooth)
            setTimeout(() => scrollToBottom(false), 100);

            // Mark as read if not from current user
            if (data.sender_pet_id !== currentPetId) {
              markMessagesAsRead();
            }
          }
        },
      )
      .subscribe();
  };

  const subscribeToReactions = () => {
    if (!match) return;

    reactionsChannelRef.current = supabase
      .channel(`reactions:${match.matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        async () => {
          // Reload all reactions when any change happens
          await loadReactions();
        },
      )
      .subscribe();
  };

  const subscribeToTyping = () => {
    if (!match) return;

    typingChannelRef.current = supabase.channel(`typing:${match.matchId}`);

    typingChannelRef.current
      .on("broadcast", { event: "typing" }, (payload) => {
        // Only show typing if it's from the other person
        if (payload.payload.petId !== currentPetId) {
          // Clear previous timeout to avoid multiple timers
          if (otherTypingTimeoutRef.current) {
            clearTimeout(otherTypingTimeoutRef.current);
          }

          // Only update state if not already typing (prevent unnecessary re-renders)
          setIsOtherTyping((prev) => {
            if (!prev) return true;
            return prev; // Don't update if already true
          });

          // Auto hide after 2 seconds of no typing events
          otherTypingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
          }, 2000);
        }
      })
      .subscribe();
  };

  const broadcastTyping = () => {
    if (!match) return;

    // Throttle: only broadcast if not already broadcasted recently
    if (typingTimeoutRef.current) {
      return; // Skip if already have an active timeout
    }

    // Broadcast typing event
    supabase.channel(`typing:${match.matchId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { petId: currentPetId },
    });

    // Throttle: prevent sending too many events (max once per 1.5 seconds)
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1500);
  };

  // Call functions
  const initializeCall = () => {
    if (match && !webrtcManagerRef.current) {
      webrtcManagerRef.current = new WebRTCManager(match.matchId);

      webrtcManagerRef.current.onRemoteStream((stream) => {
        setRemoteStream(stream);
      });

      webrtcManagerRef.current.onCallEnd(() => {
        endCall();
      });

      subscribeToCallSignals();
    }
  };

  const subscribeToCallSignals = () => {
    if (!match) return;

    callChannelRef.current = supabase.channel(`call:${match.matchId}`);

    callChannelRef.current
      .on("broadcast", { event: "offer" }, async (payload: any) => {
        if (payload.payload.to === currentPetId) {
          // Incoming call
          setIsIncomingCall(true);
          setCallType(payload.payload.type);
          setCallStatus("ringing");

          if (!webrtcManagerRef.current) {
            webrtcManagerRef.current = new WebRTCManager(match.matchId);
            webrtcManagerRef.current.onRemoteStream((stream) => {
              setRemoteStream(stream);
            });
            webrtcManagerRef.current.onCallEnd(() => {
              endCall();
            });
          }

          await webrtcManagerRef.current.handleOffer(
            payload.payload.offer,
            currentPetId,
          );
        }
      })
      .on("broadcast", { event: "answer" }, async (payload: any) => {
        if (payload.payload.to === currentPetId) {
          // Call answered
          setCallStatus("active");

          // Clear timeout when call is answered
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }

          // Record call start time
          callStartTimeRef.current = Date.now();
        }
      })
      .on("broadcast", { event: "call-rejected" }, () => {
        // Call was rejected
        alert("Call was rejected");
        endCall(false);
      })
      .subscribe();
  };

  const startCall = async (type: CallType) => {
    if (!match) return;

    try {
      setCallType(type);
      setCallStatus("connecting");
      setIsIncomingCall(false);

      initializeCall();

      const stream = await webrtcManagerRef.current!.startCall(
        type,
        match.otherPet.id,
        currentPetId,
      );
      setLocalStream(stream);

      // Set timeout: auto-end call after 60 seconds if not answered
      callTimeoutRef.current = setTimeout(() => {
        if (callStatus !== "active") {
          alert("Call not answered");
          endCall(false); // Don't save to history if not answered
        }
      }, 60000); // 60 seconds
    } catch (error) {
      console.error("Error starting call:", error);
      alert("Could not access camera/microphone. Please check permissions.");
      setCallStatus("idle");
    }
  };

  const acceptCall = async () => {
    if (!match || !callType) return;

    try {
      const stream = await webrtcManagerRef.current!.acceptCall(
        callType,
        match.otherPet.id,
        currentPetId,
      );
      setLocalStream(stream);
      setCallStatus("active");

      // Clear timeout when call is answered
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      // Record call start time
      callStartTimeRef.current = Date.now();
    } catch (error) {
      console.error("Error accepting call:", error);
      alert("Could not access camera/microphone.");
      endCall(false);
    }
  };

  const rejectCall = async () => {
    // Send rejection signal to the other side
    if (match && webrtcManagerRef.current) {
      await webrtcManagerRef.current.sendRejectSignal();
    }
    endCall(false);
  };

  const endCall = async (saveHistory = true) => {
    // Calculate call duration if call was active
    let duration = 0;
    if (callStartTimeRef.current && saveHistory) {
      duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000); // in seconds

      // Save call history to messages
      if (match && callType && duration > 0) {
        try {
          await fetch("/api/messages/call-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              matchId: match.matchId,
              callType,
              duration,
            }),
          });
        } catch (error) {
          console.error("Error saving call history:", error);
        }
      }
    }

    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (webrtcManagerRef.current) {
      await webrtcManagerRef.current.endCall();
      webrtcManagerRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setCallStatus("idle");
    setCallType(null);
    setIsIncomingCall(false);
    callStartTimeRef.current = null;
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    if (!currentUserId) return;

    // Optimistic update
    setReactions((prev) => {
      const messageReactions = prev[messageId] || [];
      const userReaction = messageReactions.find(
        (r) => r.user_id === currentUserId,
      );

      if (userReaction) {
        if (userReaction.reaction === reaction) {
          // Remove reaction
          return {
            ...prev,
            [messageId]: messageReactions.filter(
              (r) => r.user_id !== currentUserId,
            ),
          };
        } else {
          // Update reaction
          return {
            ...prev,
            [messageId]: messageReactions.map((r) =>
              r.user_id === currentUserId ? { ...r, reaction } : r,
            ),
          };
        }
      } else {
        // Add reaction
        return {
          ...prev,
          [messageId]: [
            ...messageReactions,
            { user_id: currentUserId, reaction },
          ],
        };
      }
    });

    try {
      await fetch("/api/messages/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reaction }),
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
      // Reload reactions on error
      loadReactions();
    }
  };

  const handleScrollToMessage = (messageId: string) => {
    const element = messageRefs.current[messageId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight effect
      element.style.backgroundColor = "rgba(236, 72, 153, 0.1)";
      setTimeout(() => {
        element.style.backgroundColor = "";
      }, 2000);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    textareaRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resizeImage = (
    file: File,
    maxWidth = 800,
    maxHeight = 800,
  ): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });
                resolve(resizedFile);
              } else {
                resolve(file);
              }
            },
            file.type,
            0.9,
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      // Resize image first
      const resizedFile = await resizeImage(file);

      // Sanitize filename: remove special chars, keep only alphanumeric, dash, underscore, dot
      const ext = file.name.split(".").pop() || "jpg";
      const safeName = file.name
        .replace(/\.[^.]+$/, "") // remove extension
        .normalize("NFD") // decompose unicode
        .replace(/[\u0300-\u036f]/g, "") // remove diacritics
        .replace(/[^a-zA-Z0-9_-]/g, "_") // replace special chars with underscore
        .substring(0, 50); // limit length

      const fileName = `${Date.now()}-${safeName}.${ext}`;
      const { data, error } = await supabase.storage
        .from("messages")
        .upload(fileName, resizedFile);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("messages").getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const handleSendMessage = async () => {
    if (!match || (!newMessage.trim() && !selectedImage) || isSending) return;

    const messageContent = newMessage.trim();
    const imageToSend = selectedImage;
    const imagePreviewToShow = imagePreview;
    const replyingToMessage = replyingTo;

    // Clear input immediately (optimistic UI)
    setNewMessage("");
    handleRemoveImage();
    cancelReply();

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent || null,
      image_url: imagePreviewToShow,
      sender_pet_id: currentPetId,
      reply_to_message_id: replyingToMessage?.id || null,
      is_read: false,
      created_at: new Date().toISOString(),
      isOptimistic: true,
      sender: {
        id: currentPetId,
        name: "You",
        avatar_url: null,
      },
      replied_message: replyingToMessage
        ? {
            id: replyingToMessage.id,
            content: replyingToMessage.content,
            image_url: replyingToMessage.image_url,
            sender_pet_id: replyingToMessage.sender_pet_id,
            sender: replyingToMessage.sender,
          }
        : null,
    };

    // Add optimistic message to UI
    setMessages((prev) => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      let imageUrl = null;
      if (imageToSend) {
        imageUrl = await uploadImage(imageToSend);
      }

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.matchId,
          content: messageContent || null,
          imageUrl,
          replyToMessageId: replyingToMessage?.id || null,
        }),
      });

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMessage.id),
        );
        console.error("Failed to send message");
      }
      // Real message will be added via realtime subscription
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center text-gray-600">
          <p className="text-lg">Chọn một cuộc trò chuyện để bắt đầu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <Image
            src={match.otherPet.avatar_url || "https://via.placeholder.com/40"}
            alt={match.otherPet.name}
            width={40}
            height={40}
            className="rounded-full object-cover max-w-[40px] max-h-[40px]"
          />
          <h3 className="ml-3 font-semibold text-gray-900 text-lg">
            {match.otherPet.name}
          </h3>
        </div>

        {/* Call Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => startCall("audio")}
            className="p-2.5 rounded-full hover:bg-gray-100 text-gray-700 transition-colors"
            title="Voice call"
          >
            <IoCall size={22} />
          </button>
          <button
            onClick={() => startCall("video")}
            className="p-2.5 rounded-full hover:bg-gray-100 text-pink-500 transition-colors"
            title="Video call"
          >
            <IoVideocam size={22} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100 scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {isLoadingMore && (
          <div className="text-center py-2">
            <span className="text-sm text-gray-500">Loading ...</span>
          </div>
        )}
        {messages.map((message, index) => {
          const nextMessage = messages[index + 1];
          const prevMessage = messages[index - 1];

          // Check nếu tin nhắn tiếp theo là từ cùng người và trong vòng 2 phút
          const isSameSenderNext =
            nextMessage && nextMessage.sender_pet_id === message.sender_pet_id;
          const isWithin2Minutes =
            nextMessage &&
            new Date(nextMessage.created_at).getTime() -
              new Date(message.created_at).getTime() <
              2 * 60 * 1000;

          // Check nếu tin nhắn trước đó là từ cùng người và trong vòng 2 phút
          const isSameSenderPrev =
            prevMessage && prevMessage.sender_pet_id === message.sender_pet_id;
          const isPrevWithin2Minutes =
            prevMessage &&
            new Date(message.created_at).getTime() -
              new Date(prevMessage.created_at).getTime() <
              2 * 60 * 1000;

          // Chỉ hiện avatar và timestamp ở tin nhắn cuối cùng của group
          const shouldShowAvatar = !(isSameSenderNext && isWithin2Minutes);
          const shouldShowTimestamp = shouldShowAvatar;

          return (
            <div
              key={message.id}
              ref={(el) => {
                if (el) messageRefs.current[message.id] = el;
              }}
            >
              <MessageBubble
                message={message}
                isOwnMessage={message.sender_pet_id === currentPetId}
                showAvatar={shouldShowAvatar}
                showTimestamp={shouldShowTimestamp}
                currentUserId={currentUserId}
                reactions={reactions[message.id] || []}
                onReaction={handleReaction}
                onReply={handleReply}
                onScrollToMessage={handleScrollToMessage}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {replyingTo.image_url && (
              <Image
                src={replyingTo.image_url}
                alt="Reply image"
                width={40}
                height={40}
                className="rounded object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">
                Replying to{" "}
                {replyingTo.sender_pet_id === currentPetId
                  ? "yourself"
                  : replyingTo.sender.name}
              </p>
              <p className="text-sm text-gray-900 truncate">
                {replyingTo.content || "📷 Hình ảnh"}
              </p>
            </div>
          </div>
          <button
            onClick={cancelReply}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <IoClose size={20} />
          </button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <Image
              src={imagePreview}
              alt="Preview"
              width={100}
              height={100}
              className="rounded-lg object-cover"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <IoClose size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Typing Indicator */}
      {isOtherTyping && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{match?.otherPet.name} is typing</span>
            <div className="flex gap-1">
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></span>
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></span>
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></span>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white shadow-lg">
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-pink-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <IoImageOutline size={24} />
          </button>
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              broadcastTyping();
            }}
            onKeyPress={handleKeyPress}
            placeholder={
              replyingTo
                ? `Trả lời ${replyingTo.sender.name}...`
                : "Nhập tin nhắn..."
            }
            className="flex-1 bg-gray-100 text-gray-900 border border-gray-300 rounded-2xl px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedImage) || isSending}
            className="p-2  text-gray-900 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IoSend size={20} />
          </button>
        </div>
      </div>

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={callStatus !== "idle"}
        callType={callType || "audio"}
        isIncoming={isIncomingCall}
        callerName={match.otherPet.name}
        callerAvatar={match.otherPet.avatar_url}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        localStream={localStream}
        remoteStream={remoteStream}
        callStatus={callStatus}
      />
    </div>
  );
}
