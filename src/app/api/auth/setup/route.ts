import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { profile, pet } = await request.json();

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng" },
        { status: 401 },
      );
    }

    // Update user profile
    const { error: profileError } = await supabase
      .from("users")
      .update({
        full_name: profile.fullName,
        phone: profile.phone,
        bio: profile.bio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Profile error:", profileError);
      return NextResponse.json(
        { error: "Lỗi khi cập nhật thông tin cá nhân" },
        { status: 500 },
      );
    }

    // Add pet
    const { error: petError } = await supabase.from("pets").insert({
      owner_id: user.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: parseInt(pet.age),
      gender: pet.gender,
      bio: pet.description,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (petError) {
      console.error("Pet error:", petError);
      return NextResponse.json(
        { error: "Lỗi khi thêm thú cưng" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Thiết lập tài khoản thành công" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Có lỗi xảy ra khi thiết lập tài khoản" },
      { status: 500 },
    );
  }
}
