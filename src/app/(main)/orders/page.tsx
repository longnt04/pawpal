"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  products: {
    name: string;
    images: string[];
  } | null;
};

type Order = {
  id: string;
  total_price: number;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: OrderItem[];
  phone: string;
  shipping_address: string;
};

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 5;

  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const toggleOrder = (id: string) => {
    setExpandedOrderId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    fetchOrders(page);
  }, [page]);

  const totalPages = Math.ceil(totalOrders / PAGE_SIZE);

  const fetchOrders = async (currentPage = 1) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from("orders")
      .select(
        `
      id,
      total_price,
      status,
      payment_status,
      created_at,
      phone,
      shipping_address
    `,
        { count: "exact" }, // 👈 để biết tổng số đơn
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to); // 👈 PHÂN TRANG Ở ĐÂY

    const { data: orderItems, error } = await supabase.from("order_items")
      .select(`
        id,
        order_id,
        price,
        quantity,
        products:product_id (
          name,
          images
        )
      `);

    if (error) {
      console.error(error);
    } else {
      console.log(orderItems);
    }

    const mergedOrders: Order[] = (data || []).map((order: any) => ({
      ...order,
      order_items: orderItems!.filter(
        (item: any) => item.order_id === order.id,
      ),
    }));

    setOrders(mergedOrders);

    setTotalOrders(count || 0);
    setLoading(false);
  };

  const getPaymentStatus = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-400";
      case "pending":
        return "text-yellow-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getShippingStatus = (status: string) => {
    switch (status) {
      case "processing":
        return "text-yellow-400";
      case "shipping":
        return "text-blue-400";
      case "completed":
        return "text-green-400";
      case "cancelled":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-6 py-12">
      {loading ? (
        <p className="text-gray-600">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-600">You have no orders</p>
      ) : (
        <div className="space-y-8">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl p-6 shadow-lg">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Mã đơn: {order.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p
                      className={`font-semibold ${getShippingStatus(order.status)}`}
                    >
                       {order.status.toUpperCase()}
                    </p>
                    <p
                      className={`text-sm ${getPaymentStatus(order.payment_status)}`}
                    >
                       {order.payment_status.toUpperCase()}
                    </p>
                    <p className="text-pink-400 font-bold text-lg">
                      {(order.total_price ?? 0).toLocaleString()}₫
                    </p>
                  </div>

                  {/* Nút xổ */}
                  <button
                    onClick={() => toggleOrder(order.id)}
                    className="text-2xl transition-transform duration-300"
                  >
                    {expandedOrderId === order.id ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {/* Thông tin giao hàng */}
              <div className="mb-4 border-t border-gray-700 pt-4 text-sm text-gray-300 space-y-1">
                <p> SĐT: {order.phone}</p>
                <p> Địa chỉ: {order.shipping_address}</p>
              </div>

              {/* Chi tiết sản phẩm (accordion) */}
              {expandedOrderId === order.id && (
                <div className="space-y-3 mt-4 border-t border-gray-700 pt-4">
                  {order.order_items.map((item) => {
                    const product = item.products;
                    if (!product) return null;

                    return (
                      <div
                        key={item.id}
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
                            {item.quantity} x{" "}
                            {(item.price ?? 0).toLocaleString()}₫
                          </p>
                        </div>

                        <p className="text-pink-400 font-semibold">
                          {((item.price ?? 0) * item.quantity).toLocaleString()}
                          ₫
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Pagination */}
      {orders.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-40"
          >
            ← Trang trước
          </button>

          <span className="text-gray-300">
            Trang {page} / {totalPages || 1}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-40"
          >
            Trang sau →
          </button>
        </div>
      )}
    </div>
  );
}
