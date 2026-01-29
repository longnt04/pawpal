"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import toast from "react-hot-toast";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  category: string;
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const supabase = createClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (id) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return;

    setProduct(data);

    // Lấy sản phẩm liên quan cùng category
    const { data: relatedData } = await supabase
      .from("products")
      .select("*")
      .eq("category", data.category)
      .neq("id", data.id)
      .limit(4);

    setRelated(relatedData || []);
  };

  const addToCart = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return toast.error("Vui lòng đăng nhập");

    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      product_id: product?.id,
      quantity,
    });

    if (error) toast.error("Không thể thêm vào giỏ");
    else toast.success(`Đã thêm ${quantity} sản phẩm vào giỏ 🐾`);
  };

  if (!product)
    return <p className="text-center text-gray-400 mt-20">Đang tải...</p>;

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-12">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10">
        {/* Ảnh sản phẩm */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <Image
            src={product.images?.[0] || "/no-image.png"}
            alt={product.name}
            width={600}
            height={500}
            className="rounded-xl object-cover w-full h-[400px]"
          />
        </div>

        {/* Thông tin */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <p className="text-gray-400 mb-6">{product.description}</p>

          <p className="text-2xl font-bold text-pink-400 mb-6">
            {product.price.toLocaleString()}₫
          </p>

          {/* Chọn số lượng */}
          <div className="flex items-center gap-4 mb-6">
            <span>Số lượng:</span>
            <div className="flex items-center bg-gray-800 rounded-lg">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-1 text-lg"
              >
                −
              </button>
              <span className="px-4">{quantity}</span>
              <button
                onClick={() =>
                  setQuantity((q) => Math.min(product.stock, q + 1))
                }
                className="px-3 py-1 text-lg"
              >
                +
              </button>
            </div>
            <span className="text-sm text-gray-500">
              Còn {product.stock} sản phẩm
            </span>
          </div>

          <button
            onClick={addToCart}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90"
          >
            <ShoppingCart size={20} />
            Thêm vào giỏ hàng
          </button>
        </div>
      </div>

      {/* Sản phẩm liên quan */}
      {related.length > 0 && (
        <div className="mt-16 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">
            🐾 Sản phẩm liên quan
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/shop/${item.id}`}
                className="bg-gray-800 rounded-2xl overflow-hidden hover:scale-[1.02] transition"
              >
                <Image
                  src={item.images?.[0] || "/no-image.png"}
                  alt={item.name}
                  width={400}
                  height={300}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-white font-semibold">{item.name}</h3>
                  <p className="text-pink-400 font-bold mt-2">
                    {item.price.toLocaleString()}₫
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
