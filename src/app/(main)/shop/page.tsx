"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import toast from "react-hot-toast";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 8;

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
};

export default function ShopPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const totalPages = Math.ceil(totalProducts / PAGE_SIZE);

  useEffect(() => {
    fetchProducts(page);
  }, [page]);

  const fetchProducts = async (pageNumber: number) => {
    setLoading(true);

    const from = (pageNumber - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // 🔎 Search theo tên
    if (search.trim() !== "") {
      query = query.ilike("name", `%${search}%`);
    }

    // 💰 Filter giá
    if (minPrice !== "") {
      query = query.gte("price", Number(minPrice));
    }
    if (maxPrice !== "") {
      query = query.lte("price", Number(maxPrice));
    }

    const { data, count, error } = await query.range(from, to);

    if (!error && data) {
      setProducts(data);
      setTotalProducts(count || 0);
    }

    setLoading(false);
  };

  const addToCart = async (productId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return toast.error("Vui lòng đăng nhập");

    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      product_id: productId,
      quantity: 1,
    });

    if (error) toast.error("Không thể thêm vào giỏ");
    else toast.success("Đã thêm vào giỏ hàng 🐾");
  };

  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [search, minPrice, maxPrice]);

  return (
    <div className="min-h-screen bg-gray-900 px-6 py-12">
      <h1 className="text-4xl font-bold mb-10 text-center bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
        🛍️ Cửa hàng thú cưng
      </h1>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Filter */}
        <div className="md:col-span-1 bg-gray-800 p-6 rounded-2xl h-fit sticky top-24 space-y-6">
          <h2 className="text-xl font-bold text-white mb-2">Tìm kiếm</h2>

          <input
            type="text"
            placeholder="Tên sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white outline-none"
          />

          <div>
            <h2 className="text-xl font-bold text-white mt-6 mb-2">
              Khoảng giá
            </h2>

            <div className="space-y-3">
              <input
                type="number"
                placeholder="Giá từ"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white outline-none"
              />

              <input
                type="number"
                placeholder="Đến giá"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setSearch("");
              setMinPrice("");
              setMaxPrice("");
            }}
            className="w-full mt-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 font-semibold"
          >
            Làm mới bộ lọc
          </button>
        </div>

        {/* Product List */}
        <div className="md:col-span-3">
          {loading ? (
            <p className="text-center text-gray-400">Đang tải sản phẩm...</p>
          ) : (
            <>
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((p) => (
                  <Link key={p.id} href={`/shop/${p.id}`} className="block">
                    <div
                      key={p.id}
                      className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:scale-[1.02] transition"
                    >
                      <Image
                        src={p.images?.[0] || "/no-image.png"}
                        alt={p.name}
                        width={400}
                        height={300}
                        className="w-full h-48 object-cover"
                      />

                      <div className="p-4">
                        <h2 className="text-lg font-semibold text-white">
                          {p.name}
                        </h2>
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {p.description}
                        </p>

                        <div className="flex items-center justify-between mt-4">
                          <span className="text-pink-400 font-bold">
                            {p.price.toLocaleString()}₫
                          </span>

                          <button
                            onClick={() => addToCart(p.id)}
                            className="p-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90"
                          >
                            <ShoppingCart size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex justify-center mt-12 gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-white disabled:opacity-40"
                >
                  ← Trước
                </button>

                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`px-4 py-2 rounded-lg ${
                      page === i + 1
                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                        : "bg-gray-800 text-gray-300"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-white disabled:opacity-40"
                >
                  Sau →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
