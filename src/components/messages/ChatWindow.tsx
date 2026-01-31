"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { IoSend, IoImageOutline, IoClose } from "react-icons/io5";
import MessageBubble from "./MessageBubble";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  content: string | null;
  image_url: string | null;
  sender_pet_id: string;
  is_read: boolean;
  created_at: string;
  sender: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (match) {
      loadMessages();
      markMessagesAsRead();
      subscribeToMessages();
    }

    return () => {
      supabase.channel(`messages:${match?.matchId}`).unsubscribe();
    };
  }, [match]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!match) return;

    try {
      const response = await fetch(
        `/api/messages/list?matchId=${match.matchId}`,
      );
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
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

    const channel = supabase
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

            const message: Message = {
              ...data,
              sender,
            };

            setMessages((prev) => [...prev, message]);
            // Mark as read if not from current user
            if (data.sender_pet_id !== currentPetId) {
              markMessagesAsRead();
            }
          }
        },
      )
      .subscribe();
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

    setIsSending(true);

    try {
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.matchId,
          content: newMessage.trim() || null,
          imageUrl,
        }),
      });

      if (response.ok) {
        setNewMessage("");
        handleRemoveImage();
      }
    } catch (error) {
      console.error("Error sending message:", error);
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
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-400">
          <p className="text-lg">Chọn một cuộc trò chuyện để bắt đầu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800 flex items-center">
        <Image
          src={match.otherPet.avatar_url || "https://via.placeholder.com/40"}
          alt={match.otherPet.name}
          width={40}
          height={40}
          className="rounded-full object-cover max-w-[40px] max-h-[40px]"
        />
        <h3 className="ml-3 font-semibold text-white text-lg">
          {match.otherPet.name}
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
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
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.sender_pet_id === currentPetId}
              showAvatar={shouldShowAvatar}
              showTimestamp={shouldShowTimestamp}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

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

      {/* Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
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
            className="p-2 text-pink-500 hover:bg-gray-700 rounded-full transition-colors"
          >
            <IoImageOutline size={24} />
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-gray-700 text-white rounded-2xl px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedImage) || isSending}
            className="p-2  text-white rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IoSend size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
