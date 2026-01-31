"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { GiPawHeart } from "react-icons/gi";
import { IoImageOutline, IoClose } from "react-icons/io5";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({
  isOpen,
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const supabase = createClient();
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadUserPets();
    }
  }, [isOpen]);

  const loadUserPets = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: petsData } = await supabase
      .from("pets")
      .select("*")
      .eq("owner_id", user.id)
      .eq("is_active", true);

    if (petsData) {
      setPets(petsData);
      if (petsData.length > 0) {
        setSelectedPet(petsData[0].id);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 4) {
      toast.error("Chỉ được chọn tối đa 4 ảnh");
      return;
    }

    setSelectedImages((prev) => [...prev, ...files]);

    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const file of selectedImages) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { data, error } = await supabase.storage
        .from("post-image")
        .upload(filePath, file);

      if (error) {
        throw new Error(`Lỗi tải ảnh: ${error.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-image").getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPet || !content.trim()) {
      toast.error("Vui lòng chọn thú cưng và nhập nội dung");
      return;
    }

    setLoading(true);
    try {
      // Upload images first
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        imageUrls = await uploadImages();
      }

      const response = await fetch("/api/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petId: selectedPet,
          content: content.trim(),
          images: imageUrls,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Có lỗi xảy ra");
      }

      toast.success("Đăng bài thành công!");
      setContent("");
      setSelectedImages([]);
      setImagePreviews([]);
      onPostCreated();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Tạo bài đăng mới
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {pets.length === 0 ? (
          <div className="text-center py-8">
            <GiPawHeart className="text-7xl mx-auto mb-4 text-pink-500" />
            <p className="text-gray-600">
              Bạn chưa có thú cưng nào. Hãy thêm thú cưng trước!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn thú cưng
              </label>
              <div className="flex items-center gap-3">
                {selectedPet && pets.find((p) => p.id === selectedPet) && (
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    {pets.find((p) => p.id === selectedPet)?.avatar_url ? (
                      <img
                        src={pets.find((p) => p.id === selectedPet)?.avatar_url}
                        alt="Pet"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {pets.find((p) => p.id === selectedPet)?.name?.[0] ||
                          "P"}
                      </span>
                    )}
                  </div>
                )}
                <select
                  value={selectedPet}
                  onChange={(e) => setSelectedPet(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-gray-100 focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                  required
                >
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nội dung
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Chia sẻ điều gì đó về thú cưng của bạn..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-gray-100 focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                rows={5}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ảnh (Tối đa 4 ảnh)
              </label>
              <div className="space-y-3">
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-pink-400 transition">
                  <IoImageOutline className="text-2xl text-gray-500" />
                  <span className="text-gray-600">Chọn ảnh</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={selectedImages.length >= 4}
                  />
                </label>

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition"
                        >
                          <IoClose className="text-lg" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition disabled:opacity-50"
              >
                {loading ? "Đang đăng..." : "Đăng bài"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
