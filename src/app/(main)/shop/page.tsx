import { IoStorefront } from "react-icons/io5";

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <IoStorefront className="text-8xl mb-6 mx-auto text-pink-500" />
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-4">
          Shop Coming Soon!
        </h1>
        <p className="text-gray-600 text-lg">
          Cửa hàng đồ thú cưng đang được chuẩn bị...
        </p>
      </div>
    </div>
  );
}
