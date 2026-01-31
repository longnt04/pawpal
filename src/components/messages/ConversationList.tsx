"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface Match {
  matchId: string;
  otherPet: {
    id: string;
    name: string;
    avatar_url: string | null;
    owner_id: string;
  };
  lastMessage: {
    content: string | null;
    image_url: string | null;
    created_at: string;
    sender_pet_id: string;
  } | null;
  unreadCount: number;
  isOnline: boolean;
}

interface ConversationListProps {
  matches: Match[];
  selectedMatchId: string | null;
  onSelectMatch: (matchId: string) => void;
  currentPetId: string;
}

export default function ConversationList({
  matches,
  selectedMatchId,
  onSelectMatch,
  currentPetId,
}: ConversationListProps) {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Tin nhắn</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {matches.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>Chưa có cuộc trò chuyện nào</p>
            <p className="text-sm mt-2">
              Hãy match với các thú cưng khác để bắt đầu nhắn tin!
            </p>
          </div>
        ) : (
          matches.map((match) => (
            <div
              key={match.matchId}
              onClick={() => onSelectMatch(match.matchId)}
              className={`flex items-center p-4 hover:bg-gray-100 cursor-pointer transition-colors ${
                selectedMatchId === match.matchId ? "bg-gray-100" : ""
              }`}
            >
              <div className="relative">
                <Image
                  src={
                    match.otherPet.avatar_url ||
                    "https://via.placeholder.com/48"
                  }
                  alt={match.otherPet.name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover max-w-[48px] max-h-[48px]"
                />
                {/* Online status indicator */}
                {match.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-800"></div>
                )}
                {/* Unread count badge */}
                {match.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {match.unreadCount}
                  </div>
                )}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {match.otherPet.name}
                  </h3>
                  {match.lastMessage && (
                    <span className="text-xs text-gray-500 ml-2">
                      {formatDistanceToNow(
                        new Date(match.lastMessage.created_at),
                        { addSuffix: true, locale: vi },
                      )}
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm truncate ${
                    match.unreadCount > 0
                      ? "text-gray-900 font-medium"
                      : "text-gray-600"
                  }`}
                >
                  {match.lastMessage
                    ? match.lastMessage.sender_pet_id === currentPetId
                      ? // Tin nhắn từ mình
                        match.lastMessage.image_url
                        ? "You: Đã gửi một ảnh"
                        : `You: ${match.lastMessage.content}`
                      : // Tin nhắn từ người khác
                        match.lastMessage.image_url
                        ? "Đã gửi một ảnh"
                        : match.lastMessage.content
                    : "Bắt đầu trò chuyện"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
