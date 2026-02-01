"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AddProductPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [product, setProduct] = useState({
    name: "",
    description: "",
    price: "",
    category: "food",
    stock: "",
  });

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

  const handleCreate = async () => {
    try {
      setLoading(true);

      let imageUrl: string | null = null;
      if (imageFile) imageUrl = await uploadImage();

      const { error } = await supabase.from("products").insert({
        name: product.name,
        description: product.description,
        price: Number(product.price),
        category: product.category,
        stock: Number(product.stock),
        images: imageUrl ? [imageUrl] : [],
        is_active: true,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Product created successfully 🎉");
      router.push("/admin/products");
    } catch (err: any) {
      toast.error(err.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add New Product</h1>

      <div className="space-y-4">
        <input
          placeholder="Product name"
          className="border p-3 w-full rounded-lg"
          value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
        />

        <textarea
          placeholder="Description"
          className="border p-3 w-full rounded-lg"
          rows={4}
          value={product.description}
          onChange={(e) =>
            setProduct({ ...product, description: e.target.value })
          }
        />

        <input
          type="number"
          placeholder="Price"
          className="border p-3 w-full rounded-lg"
          value={product.price}
          onChange={(e) => setProduct({ ...product, price: e.target.value })}
        />

        <input
          type="number"
          placeholder="Stock quantity"
          className="border p-3 w-full rounded-lg"
          value={product.stock}
          onChange={(e) => setProduct({ ...product, stock: e.target.value })}
        />

        <select
          className="border p-3 w-full rounded-lg"
          value={product.category}
          onChange={(e) => setProduct({ ...product, category: e.target.value })}
        >
          <option value="food">Food</option>
          <option value="toy">Toy</option>
          <option value="accessory">Accessory</option>
        </select>

        <div>
          <label className="block mb-2 font-medium">Product Image</label>

          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
              {imageFile ? (
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm text-gray-400 text-center px-2">
                  No image selected
                </span>
              )}
            </div>

            {/* Upload Button */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition">
                Choose Image
              </div>
            </label>
          </div>

          {imageFile && (
            <p className="text-sm text-gray-500 mt-2">
              Selected: {imageFile.name}
            </p>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg w-full hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Product"}
        </button>
      </div>
    </div>
  );
}
