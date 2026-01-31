"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

export default function StatisticsPage() {
  const supabase = createClient();
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [orderCountData, setOrderCountData] = useState<any[]>([]);

  const [range, setRange] = useState<"today" | "7days" | "30days" | "all">(
    "7days",
  );

  useEffect(() => {
    fetchStats();
  }, [range]);

  const fetchStats = async () => {
    let query = supabase.from("orders").select("created_at, total_price");

    const now = new Date();

    if (range !== "all") {
      let fromDate = new Date();

      if (range === "today") {
        fromDate.setHours(0, 0, 0, 0);
      }

      if (range === "7days") {
        fromDate.setDate(now.getDate() - 6);
      }

      if (range === "30days") {
        fromDate.setDate(now.getDate() - 29);
      }

      query = query.gte("created_at", fromDate.toISOString());
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    const revenueMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};

    orders?.forEach((o) => {
      if (!o.created_at) return;

      const date = new Date(o.created_at).toISOString().split("T")[0]; // yyyy-mm-dd

      const price = Number(o.total_price) || 0;

      revenueMap[date] = (revenueMap[date] || 0) + price;
      countMap[date] = (countMap[date] || 0) + 1;
    });

    const sortedRevenue = Object.keys(revenueMap)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date) => ({ date, revenue: revenueMap[date] }));

    const sortedCount = Object.keys(countMap)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date) => ({ date, orders: countMap[date] }));

    setRevenueData(sortedRevenue);
    setOrderCountData(sortedCount);
  };

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Statistics Overview</h1>

      <div className="flex gap-2 mb-4">
        {[
          { key: "today", label: "Today" },
          { key: "7days", label: "Last 7 days" },
          { key: "30days", label: "Last 30 days" },
          { key: "all", label: "All" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setRange(item.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              range === item.key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-semibold mb-4">Revenue by Date</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={revenueData}
            margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
          >
            <XAxis dataKey="date" interval={0} tick={{ fontSize: 12 }} />

            <YAxis
              width={80}
              tickFormatter={(value) => {
                const num = Number(value) || 0;
                return num.toLocaleString("vi-VN");
              }}
            />

            <Tooltip
              formatter={(value) => {
                const num = Number(value) || 0;
                return num.toLocaleString("vi-VN") + " ₫";
              }}
            />

            <Bar dataKey="revenue" fill="#3B82F6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Orders Count Chart */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-semibold mb-4">Orders per Day</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={orderCountData}
            margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="orders"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
