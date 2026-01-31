"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  IoImageOutline,
  IoClose,
  IoAdd,
  IoPencil,
  IoTrash,
  IoSave,
} from "react-icons/io5";

interface Pet {
  id: string;
  name: string;
  breed: string;
  age: number;
  species: string;
  avatar_url: string;
  is_active: boolean;
}

export default function ProfilePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [editingPet, setEditingPet] = useState<string | null>(null);
  const [editPetData, setEditPetData] = useState<{
    name: string;
    breed: string;
    age: number;
    species: string;
    newImage: File | null;
    imagePreview: string;
  } | null>(null);
  const [addingPet, setAddingPet] = useState(false);
  const [newPet, setNewPet] = useState({
    name: "",
    breed: "",
    age: 1,
    species: "dog",
    image: null as File | null,
    imagePreview: "",
  });

  const [address, setAddress] = useState("");

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userData) {
        setUser(userData);
        setFullName(userData.full_name || "");
        setPhone(userData.phone || "");
        setAddress(userData.address || ""); // 👈 thêm dòng này
        setAvatarPreview(userData.avatar_url || "");
      }

      const { data: petsData } = await supabase
        .from("pets")
        .select("*")
        .eq("owner_id", authUser.id)
        .order("created_at", { ascending: false });

      if (petsData) {
        setPets(petsData);
      }
    } catch (error) {
      console.error("Load error:", error);
      toast.error("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from("avatar")
      .upload(filePath, file);
    if (error) throw new Error(`Lỗi tải ảnh: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatar").getPublicUrl(filePath);
    return publicUrl;
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      let avatarUrl = user?.avatar_url;

      if (newAvatar) {
        avatarUrl = await uploadImage(newAvatar, "avatars");
      }

      const { error } = await supabase
        .from("users")
        .update({
          full_name: fullName,
          phone: phone,
          address: address,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Cập nhật thành công!");
      await loadUserData();
      setNewAvatar(null);
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error.message || "Cập nhật thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleNewPetImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPet({ ...newPet, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPet({
          ...newPet,
          image: file,
          imagePreview: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPet = async () => {
    if (!newPet.name || !newPet.breed || !newPet.image) {
      toast.error("Vui lòng điền đầy đủ thông tin và tải ảnh");
      return;
    }

    setLoading(true);
    try {
      const imageUrl = await uploadImage(newPet.image, "pets");

      const { error } = await supabase.from("pets").insert([
        {
          owner_id: user.id,
          name: newPet.name,
          breed: newPet.breed,
          age: newPet.age,
          species: newPet.species,
          avatar_url: imageUrl,
          is_active: true,
        },
      ]);

      if (error) throw error;

      toast.success("Thêm thú cưng thành công!");
      setAddingPet(false);
      setNewPet({
        name: "",
        breed: "",
        age: 1,
        species: "dog",
        image: null,
        imagePreview: "",
      });
      await loadUserData();
    } catch (error: any) {
      console.error("Add pet error:", error);
      toast.error(error.message || "Thêm thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePet = async (petId: string) => {
    if (!confirm("Bạn có chắc muốn xóa thú cưng này?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("pets").delete().eq("id", petId);
      if (error) throw error;

      toast.success("Đã xóa thú cưng");
      await loadUserData();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Xóa thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditPet = (pet: Pet) => {
    setEditingPet(pet.id);
    setEditPetData({
      name: pet.name,
      breed: pet.breed,
      age: pet.age,
      species: pet.species,
      newImage: null,
      imagePreview: pet.avatar_url,
    });
  };

  const handleEditPetImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editPetData) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPetData({
          ...editPetData,
          newImage: file,
          imagePreview: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdatePet = async (petId: string) => {
    if (!editPetData || !editPetData.name || !editPetData.breed) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = pets.find((p) => p.id === petId)?.avatar_url;

      if (editPetData.newImage) {
        avatarUrl = await uploadImage(editPetData.newImage, "pets");
      }

      const { error } = await supabase
        .from("pets")
        .update({
          name: editPetData.name,
          breed: editPetData.breed,
          age: editPetData.age,
          species: editPetData.species,
          avatar_url: avatarUrl,
        })
        .eq("id", petId);

      if (error) throw error;

      toast.success("Cập nhật thành công!");
      setEditingPet(null);
      setEditPetData(null);
      await loadUserData();
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error.message || "Cập nhật thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditPet = () => {
    setEditingPet(null);
    setEditPetData(null);
  };

  const handleTogglePetStatus = async (
    petId: string,
    currentStatus: boolean,
  ) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("pets")
        .update({ is_active: !currentStatus })
        .eq("id", petId);

      if (error) throw error;

      toast.success(currentStatus ? "Đã ẩn thú cưng" : "Đã kích hoạt thú cưng");
      await loadUserData();
    } catch (error: any) {
      console.error("Toggle error:", error);
      toast.error("Cập nhật thất bại");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <div className="max-w-4xl mx-auto p-6">
        {/* User Profile Section */}
        <div className="card-swipe mb-6 p-4">
          <h2 className="text-2xl font-bold bg-clip-text text-white mb-6">
            Thông tin cá nhân
          </h2>

          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {avatarPreview ? (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-32 h-32 rounded-full object-cover"
                  />
                  <label className="absolute bottom-0 right-0 bg-pink-500 text-white rounded-full p-2 cursor-pointer hover:bg-pink-600">
                    <IoPencil />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src="/default-avatar.png"
                    alt="Default Avatar"
                    className="w-32 h-32 rounded-full object-cover"
                  />
                  <label className="absolute bottom-0 right-0 bg-pink-500 text-white rounded-full p-2 cursor-pointer hover:bg-pink-600">
                    <IoPencil />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Địa chỉ
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="Nhập địa chỉ của bạn..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                />
              </div>
              <button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2  text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50"
              >
                <IoSave /> Lưu thay đổi
              </button>
            </div>
          </div>
        </div>

        {/* Pets Section */}
        <div className="card-swipe p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold  bg-clip-text text-transparent">
              Thú cưng của tôi
            </h2>
            <button
              onClick={() => setAddingPet(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            >
              <IoAdd /> Thêm thú cưng
            </button>
          </div>

          {/* Add New Pet Form */}
          {addingPet && (
            <div className="mb-6 p-4 bg-gray-800 rounded-xl border-2 border-pink-500">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">
                Thêm thú cưng mới
              </h3>

              <div className="mb-4 flex justify-center">
                {newPet.imagePreview ? (
                  <div className="relative">
                    <img
                      src={newPet.imagePreview}
                      alt="Pet"
                      className="w-32 h-32 rounded-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNewPet({ ...newPet, image: null, imagePreview: "" })
                      }
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <IoClose />
                    </button>
                  </div>
                ) : (
                  <label className="w-32 h-32 rounded-full bg-gray-700 border-2 border-dashed border-gray-500 flex items-center justify-center cursor-pointer hover:bg-gray-600">
                    <IoImageOutline className="text-3xl text-gray-400" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewPetImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Tên
                  </label>
                  <input
                    type="text"
                    value={newPet.name}
                    onChange={(e) =>
                      setNewPet({ ...newPet, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Giống
                  </label>
                  <input
                    type="text"
                    value={newPet.breed}
                    onChange={(e) =>
                      setNewPet({ ...newPet, breed: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Tuổi
                  </label>
                  <input
                    type="number"
                    value={newPet.age}
                    onChange={(e) =>
                      setNewPet({
                        ...newPet,
                        age: parseInt(e.target.value) || 1,
                      })
                    }
                    min="0"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Loài
                  </label>
                  <select
                    value={newPet.species}
                    onChange={(e) =>
                      setNewPet({ ...newPet, species: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="dog">Chó</option>
                    <option value="cat">Mèo</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddPet}
                  disabled={loading}
                  className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50"
                >
                  Lưu
                </button>
                <button
                  onClick={() => {
                    setAddingPet(false);
                    setNewPet({
                      name: "",
                      breed: "",
                      age: 1,
                      species: "dog",
                      image: null,
                      imagePreview: "",
                    });
                  }}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {/* Pets List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pets.map((pet) => (
              <div key={pet.id} className="p-4 bg-gray-800 rounded-xl relative">
                {editingPet === pet.id && editPetData ? (
                  // Edit Mode
                  <>
                    <div className="mb-3 flex justify-center">
                      {editPetData.imagePreview ? (
                        <div className="relative">
                          <img
                            src={editPetData.imagePreview}
                            alt="Pet"
                            className="w-32 h-32 object-cover rounded-full"
                          />
                          <label className="absolute bottom-2 right-2 bg-pink-500 text-white rounded-full p-2 cursor-pointer hover:bg-pink-600">
                            <IoPencil />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleEditPetImageSelect}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="w-32 h-32 rounded-full bg-gray-700 border-2 border-dashed border-gray-500 flex items-center justify-center cursor-pointer hover:bg-gray-600">
                          <IoImageOutline className="text-3xl text-gray-400" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditPetImageSelect}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Tên
                        </label>
                        <input
                          type="text"
                          value={editPetData.name}
                          onChange={(e) =>
                            setEditPetData({
                              ...editPetData,
                              name: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Giống
                        </label>
                        <input
                          type="text"
                          value={editPetData.breed}
                          onChange={(e) =>
                            setEditPetData({
                              ...editPetData,
                              breed: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Tuổi
                          </label>
                          <input
                            type="number"
                            value={editPetData.age}
                            onChange={(e) =>
                              setEditPetData({
                                ...editPetData,
                                age: parseInt(e.target.value) || 1,
                              })
                            }
                            min="0"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Loài
                          </label>
                          <select
                            value={editPetData.species}
                            onChange={(e) =>
                              setEditPetData({
                                ...editPetData,
                                species: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                          >
                            <option value="dog">Chó</option>
                            <option value="cat">Mèo</option>
                            <option value="other">Khác</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleUpdatePet(pet.id)}
                        disabled={loading}
                        className="flex-1 px-3 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 text-sm disabled:opacity-50"
                      >
                        <IoSave className="inline mr-1" /> Lưu
                      </button>
                      <button
                        onClick={handleCancelEditPet}
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                      >
                        Hủy
                      </button>
                    </div>
                  </>
                ) : (
                  // View Mode
                  <>
                    <div className="flex justify-center mb-3">
                      <img
                        src={pet.avatar_url || "/default-avatar.png"}
                        alt={pet.name}
                        className="w-32 h-32 object-cover rounded-full"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-gray-200">
                      {pet.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {pet.breed} • {pet.age} tuổi •{" "}
                      {pet.species === "dog"
                        ? "Chó"
                        : pet.species === "cat"
                          ? "Mèo"
                          : "Khác"}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleStartEditPet(pet)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                      >
                        <IoPencil className="inline mr-1" /> Sửa
                      </button>
                      <button
                        onClick={() =>
                          handleTogglePetStatus(pet.id, pet.is_active)
                        }
                        className={`px-3 py-1 rounded-lg text-sm ${
                          pet.is_active
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-gray-600 hover:bg-gray-500"
                        } text-white`}
                      >
                        {pet.is_active ? "Đang hoạt động" : "Đã ẩn"}
                      </button>
                      <button
                        onClick={() => handleDeletePet(pet.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                      >
                        <IoTrash />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {pets.length === 0 && !addingPet && (
            <p className="text-center text-gray-400 py-8">
              Chưa có thú cưng nào
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
