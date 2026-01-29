"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

type OrderItem = {
  quantity: number;
  price: number;
  products: {
    name: string;
    images: string[];
  }[];
};

type Order = {
  id: string;
  total_price: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("orders")
      .select(`
        id,
        total_price,
        status,
        created_at,
        order_items (
          quantity,
          price,
          products ( name, images )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setOrders((data as Order[]) || []);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-400";
      case "pending":
        return "text-yellow-400";
      case "shipping":
        return "text-blue-400";
      case "completed":
        return "text-purple-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 px-6 py-12 text-white">
      <h1 className="text-4xl font-bold mb-10 bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
        📦 Lịch sử mua hàng
      </h1>

      {loading ? (
        <p className="text-gray-400">Đang tải đơn hàng...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-400">Bạn chưa có đơn hàng nào</p>
      ) : (
        <div className="space-y-8">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-gray-800 rounded-2xl p-6 shadow-lg"
            >
              {/* Header đơn */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm text-gray-400">
                    Mã đơn: {order.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className={`font-semibold ${getStatusColor(order.status)}`}
                  >
                    {order.status.toUpperCase()}
                  </p>
                  <p className="text-pink-400 font-bold text-lg">
                    {order.total_price.toLocaleString()}₫
                  </p>
                </div>
              </div>

              {/* Sản phẩm */}
              <div className="space-y-3">
                {order.order_items.map((item, index) => {
                  const product = item.products?.[0];
                  if (!product) return null;

                  return (
                    <div
                      key={index}
                      className="flex items-center gap-4 bg-gray-700/50 p-3 rounded-xl"
                    >
                      <Image
                        src={product.images?.[0] || "/no-image.png"}
                        alt={product.name}
                        width={60}
                        height={60}
                        className="rounded-lg object-cover"
                      />

                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-400">
                          {item.quantity} x {item.price.toLocaleString()}₫
                        </p>
                      </div>

                      <p className="text-pink-400 font-semibold">
                        {(item.price * item.quantity).toLocaleString()}₫
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
