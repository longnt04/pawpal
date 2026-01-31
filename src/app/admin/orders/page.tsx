"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function OrdersPage() {
  const supabase = createClient();

  const [orders, setOrders] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchId, setSearchId] = useState("");

  const limit = 10;

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const fetchOrders = async () => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("orders")
      .select("id, total_price, status, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    setOrders(data || []);
  };

  const handleSearch = async () => {
    if (!searchId) return fetchOrders();

    const { data } = await supabase
      .from("orders")
      .select("id, total_price, status, created_at")
      .ilike("id", `%${searchId}%`);

    setOrders(data || []);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Orders</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="border p-2 rounded"
        >
          <option value="all">All Status</option>
          <option value="processing">Processing</option>
          <option value="shipping">Shipping</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          placeholder="Search order ID..."
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="border p-2 rounded w-64"
        />

        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Search
        </button>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-xl shadow divide-y">
        {orders.map((o) => (
          <div key={o.id} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">Order #{o.id.slice(0, 8)}</p>
              <p className="text-sm text-gray-500">
                {new Date(o.created_at).toLocaleString()}
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold">
                {Number(o.total_price).toLocaleString()}₫
              </p>
              <p className="text-sm text-gray-500">{o.status}</p>
            </div>

            <Link
              href={`/admin/orders/${o.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              View
            </Link>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 mt-8">
        {/* Prev */}
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition
      ${
        page === 1
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-white hover:bg-gray-100 text-gray-700 border-gray-300"
      }`}
        >
          ← Prev
        </button>

        {/* Current Page */}
        <div className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold shadow">
          Page {page}
        </div>

        {/* Next */}
        <button
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-100 text-gray-700 border-gray-300 text-sm font-medium transition"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
