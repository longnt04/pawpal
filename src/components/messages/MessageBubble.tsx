"use client";

import Image from "next/image";
import { format } from "date-fns";

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

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
}

export default function MessageBubble({
  message,
  isOwnMessage,
  showAvatar = true,
  showTimestamp = true,
}: MessageBubbleProps) {
  return (
    <div
      className={`flex items-end gap-2 ${showTimestamp ? "mb-4" : "mb-1"} ${
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {!isOwnMessage && showAvatar && (
        <Image
          src={message.sender.avatar_url || "https://via.placeholder.com/32"}
          alt={message.sender.name}
          width={32}
          height={32}
          className="rounded-full object-cover max-w-[32px] max-h-[32px] mb-5"
        />
      )}
      {!isOwnMessage && !showAvatar && <div className="w-8 h-8" />}
      <div
        className={`max-w-[70%] ${
          isOwnMessage ? "items-end" : "items-start"
        } flex flex-col`}
      >
        {/* Chỉ có ảnh - không gradient */}
        {message.image_url && !message.content ? (
          <div className="rounded-2xl overflow-hidden">
            <Image
              src={message.image_url}
              alt="Attached image"
              width={300}
              height={300}
              className="rounded-2xl object-cover"
            />
          </div>
        ) : (
          /* Có text hoặc text + ảnh - có background */
          <div
            className={`rounded-2xl px-4 py-2 ${
              isOwnMessage
                ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                : "bg-gray-700 text-white"
            }`}
          >
            {message.image_url && (
              <div className="mb-2">
                <Image
                  src={message.image_url}
                  alt="Attached image"
                  width={300}
                  height={300}
                  className="rounded-lg object-cover"
                />
              </div>
            )}
            {message.content && (
              <p className="break-words whitespace-pre-wrap">
                {message.content}
              </p>
            )}
          </div>
        )}
        {showTimestamp && (
          <span className="text-xs text-gray-400 mt-1 px-2">
            {format(new Date(message.created_at), "HH:mm")}
          </span>
        )}
      </div>
    </div>
  );
}
