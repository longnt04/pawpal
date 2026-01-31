"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";

export default function OrderDetailPage() {
  const supabase = createClient();
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);

  const statusStyles: Record<string, string> = {
    processing: "bg-yellow-100 text-yellow-700 border-yellow-300",
    shipping: "bg-blue-100 text-blue-700 border-blue-300",
    delivered: "bg-green-100 text-green-700 border-green-300",
    cancelled: "bg-red-100 text-red-700 border-red-300",
  };

  useEffect(() => {
    fetchOrder();
  }, []);

  const fetchOrder = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*, products(name))")
      .eq("id", id)
      .single();

    setOrder(data);
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) return toast.error("Update failed");

    toast.success("Status updated");
    fetchOrder();
  };

  if (!order) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Order Detail</h1>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <p>
          <strong>Order ID:</strong> {order.id}
        </p>
        <p className="flex items-center gap-2">
          <strong>Status:</strong>
          <span
            className={`px-3 py-1 text-sm rounded-full border font-medium capitalize ${statusStyles[order.status]}`}
          >
            {order.status}
          </span>
        </p>

        <p>
          <strong>Total:</strong> {order.total_price.toLocaleString()}₫
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="font-semibold mb-4">Products</h2>
        {order.order_items.map((item: any) => (
          <div key={item.id} className="flex justify-between border-b py-2">
            <span>{item.products.name}</span>
            <span>
              {item.quantity} x {item.price.toLocaleString()}₫
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {["processing", "shipping", "delivered", "cancelled"].map((s) => {
          const isActive = order.status === s;

          return (
            <button
              key={s}
              onClick={() => !isActive && updateStatus(s)}
              disabled={isActive}
              className={`px-4 py-2 rounded-lg border text-sm font-medium capitalize transition
          ${
            isActive
              ? `${statusStyles[s]} cursor-not-allowed shadow`
              : "bg-white hover:bg-gray-100 border-gray-300 text-gray-700"
          }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
