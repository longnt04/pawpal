"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import toast from "react-hot-toast";

const PAGE_SIZE = 6;

export default function ProductListPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, [search, category, page]);

  const fetchProducts = async () => {
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order("name", { ascending: true }); // ✅ SORT NAME

    if (search) query = query.ilike("name", `%${search}%`);
    if (category !== "all") query = query.eq("category", category);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error(error);
      return;
    }

    setProducts(data || []);
    setTotal(count || 0);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !current })
      .eq("id", id);

    if (error) {
      toast.error("Update failed");
      return;
    }

    toast.success("Status updated");
    fetchProducts();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Product Management</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          placeholder="Search product..."
          className="border px-4 py-2 rounded-lg"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <select
          className="border px-4 py-2 rounded-lg"
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Categories</option>
          <option value="Chăm sóc">Care</option>
          <option value="Ăn uống">Food</option>
          <option value="Phụ kiện">Accessory</option>
          <option value="Đồ chơi">Toy</option>
        </select>

        <Link
          href="/admin/products/new"
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          + Add Product
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border-b px-6 py-4 hover:bg-gray-50"
          >
            {/* LEFT */}
            <div className="flex items-center gap-4">
              <img
                src={p.images?.[0] || "/placeholder.png"}
                className="w-16 h-16 object-cover rounded-lg border"
              />
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-500">{p.id}</p>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-4">
              {/* Status Badge */}
              <span
                className={`px-3 py-1 text-sm rounded-full font-medium ${
                  p.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {p.is_active ? "Active" : "Inactive"}
              </span>

              {/* Toggle Button */}
              <button
                onClick={() => toggleStatus(p.id, p.is_active)}
                className={`px-4 py-2 rounded-lg text-white text-sm ${
                  p.is_active
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {p.is_active ? "Deactivate" : "Activate"}
              </button>

              <Link
                href={`/admin/products/${p.id}`}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-40"
        >
          Prev
        </button>

        <span className="px-4 py-2 font-medium">
          {page} / {totalPages || 1}
        </span>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
