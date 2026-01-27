import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { petId, content, images } = await request.json();

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

    // Verify user owns the pet
    const { data: pet, error: petError } = await supabase
      .from("pets")
      .select("id")
      .eq("id", petId)
      .eq("owner_id", user.id)
      .single();

    if (petError || !pet) {
      return NextResponse.json(
        { error: "Bạn không có quyền đăng bài với thú cưng này" },
        { status: 403 },
      );
    }

    // Create post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        pet_id: petId,
        content: content,
        images: images || [],
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (postError) {
      console.error("Post error:", postError);
      return NextResponse.json(
        { error: "Lỗi khi tạo bài đăng" },
        { status: 500 },
      );
    }

    return NextResponse.json({ post }, { status: 200 });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json(
      { error: "Có lỗi xảy ra khi tạo bài đăng" },
      { status: 500 },
    );
  }
}
