"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { GiPawHeart } from "react-icons/gi";
import { IoImageOutline, IoClose, IoAdd } from "react-icons/io5";

interface PetData {
  name: string;
  breed: string;
  age: number;
  species: string;
  image: File | null;
  imagePreview: string;
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [userAvatar, setUserAvatar] = useState<File | null>(null);
  const [userAvatarPreview, setUserAvatarPreview] = useState<string>("");
  const [pets, setPets] = useState<PetData[]>([
    {
      name: "",
      breed: "",
      age: 1,
      species: "dog",
      image: null,
      imagePreview: "",
    },
  ]);
  const router = useRouter();
  const supabase = createClient();

  const handleUserAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUserAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePetImageSelect = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const newPets = [...pets];
      newPets[index].image = file;
      const reader = new FileReader();
      reader.onloadend = () => {
        newPets[index].imagePreview = reader.result as string;
        setPets(newPets);
      };
      reader.readAsDataURL(file);
    }
  };

  const updatePet = (index: number, field: keyof PetData, value: any) => {
    const newPets = [...pets];
    newPets[index] = { ...newPets[index], [field]: value };
    setPets(newPets);
  };

  const addPet = () => {
    setPets([
      ...pets,
      {
        name: "",
        breed: "",
        age: 1,
        species: "dog",
        image: null,
        imagePreview: "",
      },
    ]);
  };

  const removePet = (index: number) => {
    if (pets.length > 1) {
      setPets(pets.filter((_, i) => i !== index));
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate pets
    const invalidPet = pets.find(
      (pet) => !pet.name || !pet.breed || !pet.image,
    );
    if (invalidPet) {
      toast.error(
        "Vui lòng điền đầy đủ thông tin và tải ảnh cho tất cả thú cưng",
      );
      return;
    }

    setLoading(true);

    try {
      // Upload user avatar if provided
      let avatarUrl = null;
      if (userAvatar) {
        avatarUrl = await uploadImage(userAvatar, "avatars");
      }

      // Register with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            avatar_url: avatarUrl,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Không thể tạo tài khoản");
      }

      // Create user profile in database
      const { error: profileError } = await supabase.from("users").insert([
        {
          id: authData.user.id,
          email: email,
          full_name: fullName,
          phone: phone,
          avatar_url: avatarUrl,
        },
      ]);

      if (profileError) {
        console.error("Profile error:", profileError);
      }

      // Upload pet images and create pet profiles
      for (const pet of pets) {
        if (pet.image) {
          const petImageUrl = await uploadImage(pet.image, "pets");

          const { error: petError } = await supabase.from("pets").insert([
            {
              owner_id: authData.user.id,
              name: pet.name,
              breed: pet.breed,
              age: pet.age,
              species: pet.species,
              avatar_url: petImageUrl,
              is_active: true,
            },
          ]);

          if (petError) {
            console.error("Pet error:", petError);
          }
        }
      }

      toast.success("Đăng ký thành công!");
      router.push("/login");
      router.refresh();
    } catch (error: any) {
      console.error("Register error:", error);
      toast.error(error.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="w-full max-w-md px-8 py-10 bg-gray-800 rounded-3xl shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <GiPawHeart className="text-5xl" /> PawPal
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {" "}
            Tạo tài khoản mới
          </p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleRegister} className="space-y-5">
          {/* User Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ảnh đại diện (tùy chọn)
            </label>
            <div className="flex items-center gap-4">
              {userAvatarPreview ? (
                <div className="relative">
                  <img
                    src={userAvatarPreview}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUserAvatar(null);
                      setUserAvatarPreview("");
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <IoClose />
                  </button>
                </div>
              ) : (
                <label className="w-20 h-20 rounded-full bg-gray-700 border-2 border-dashed border-gray-500 flex items-center justify-center cursor-pointer hover:bg-gray-600">
                  <IoImageOutline className="text-3xl text-gray-400" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUserAvatarSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Họ và tên
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-white bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-white bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Số điện thoại
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-white bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 text-white bg-gray-700 rounded-xl border border-gray-600 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
            />
            <p className="text-xs text-gray-400 mt-1">Tối thiểu 6 ký tự</p>
          </div>

          {/* Pets Section */}
          <div className="border-t border-gray-700 pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-200">
                Thú cưng của bạn
              </h3>
              <button
                type="button"
                onClick={addPet}
                className="flex items-center gap-1 px-3 py-1 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600"
              >
                <IoAdd /> Thêm thú cưng
              </button>
            </div>

            {pets.map((pet, index) => (
              <div
                key={index}
                className="mb-6 p-4 bg-gray-700 rounded-xl relative"
              >
                {pets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePet(index)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-300"
                  >
                    <IoClose className="text-xl" />
                  </button>
                )}

                <h4 className="text-sm font-medium text-gray-300 mb-3">
                  Thú cưng #{index + 1}
                </h4>

                {/* Pet Image */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-400 mb-2">
                    Ảnh thú cưng *
                  </label>
                  {pet.imagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={pet.imagePreview}
                        alt="Pet"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          updatePet(index, "image", null);
                          updatePet(index, "imagePreview", "");
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <IoClose />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 rounded-lg bg-gray-600 border-2 border-dashed border-gray-500 flex items-center justify-center cursor-pointer hover:bg-gray-500">
                      <IoImageOutline className="text-2xl text-gray-400" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePetImageSelect(index, e)}
                        className="hidden"
                        required
                      />
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Tên *
                    </label>
                    <input
                      type="text"
                      value={pet.name}
                      onChange={(e) => updatePet(index, "name", e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Giống *
                    </label>
                    <input
                      type="text"
                      value={pet.breed}
                      onChange={(e) =>
                        updatePet(index, "breed", e.target.value)
                      }
                      required
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Tuổi *
                    </label>
                    <input
                      type="number"
                      value={pet.age}
                      onChange={(e) =>
                        updatePet(index, "age", parseInt(e.target.value) || 1)
                      }
                      required
                      min="0"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Loài *
                    </label>
                    <select
                      value={pet.species}
                      onChange={(e) =>
                        updatePet(index, "species", e.target.value)
                      }
                      required
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                    >
                      <option value="dog">Chó</option>
                      <option value="cat">Mèo</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Đã có tài khoản?{" "}
            <Link
              href="/login"
              className="text-pink-500 hover:text-pink-400 font-semibold"
            >
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
