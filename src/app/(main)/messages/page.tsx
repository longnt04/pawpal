import { IoChatbubbles } from "react-icons/io5";

export default function MessagesPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <IoChatbubbles className="text-8xl mb-6 mx-auto text-blue-500" />
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-4">
          Messages Coming Soon!
        </h1>
        <p className="text-gray-600 text-lg">
          Tính năng nhắn tin đang được phát triển...
        </p>
      </div>
    </div>
  );
}
