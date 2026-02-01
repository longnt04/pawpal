"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ProductDetailPage() {
  const supabase = createClient();
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProduct();
  }, []);

  const fetchProduct = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    setProduct(data);
  };

  const uploadImage = async () => {
    if (!imageFile) return null;

    const filePath = `products/${Date.now()}-${imageFile.name}`;

    const { error } = await supabase.storage
      .from("product-image")
      .upload(filePath, imageFile);

    if (error) throw error;

    const { data } = supabase.storage
      .from("product-image")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleUpdate = async () => {
    let imageUrl = product.images?.[0];

    if (imageFile) imageUrl = await uploadImage();

    const { error } = await supabase
      .from("products")
      .update({
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        stock: product.stock,
        images: [imageUrl],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return toast.error("Update failed");

    toast.success("Product updated");
    router.push("/admin/products");
  };

  if (!product) return <p>Loading...</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Product Detail</h1>

      <div className="bg-white shadow rounded-xl p-8 grid md:grid-cols-2 gap-8">
        {/* LEFT — Product Info */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">
              Product Name
            </label>
            <input
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
              className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              rows={4}
              value={product.description}
              onChange={(e) =>
                setProduct({ ...product, description: e.target.value })
              }
              className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Price (₫)
              </label>
              <input
                type="number"
                value={product.price}
                onChange={(e) =>
                  setProduct({ ...product, price: Number(e.target.value) })
                }
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stock</label>
              <input
                type="number"
                value={product.stock}
                onChange={(e) =>
                  setProduct({ ...product, stock: Number(e.target.value) })
                }
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* RIGHT — Image Upload */}
        <div className="space-y-4">
          <label className="block text-sm font-medium">Product Image</label>

          <div className="w-full h-64 border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden bg-gray-50">
            {imageFile ? (
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : product.images ? (
              <img
                src={product.images}
                alt="Current"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400">No image</span>
            )}
          </div>

          <label className="cursor-pointer inline-block">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-center">
              Change Image
            </div>
          </label>

          {imageFile && (
            <p className="text-sm text-gray-500">Selected: {imageFile.name}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleUpdate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition"
        >
          Update Product
        </button>
      </div>
    </div>
  );
}
