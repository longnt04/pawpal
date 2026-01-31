import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { matchId, content, imageUrl } = body;

    if (!matchId) {
      return NextResponse.json(
        { error: "Match ID is required" },
        { status: 400 },
      );
    }

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: "Content or image is required" },
        { status: 400 },
      );
    }

    // Lấy user hiện tại
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Lấy pet đầu tiên của user
    const { data: pets, error: petsError } = await supabase
      .from("pets")
      .select("id")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (petsError || !pets || pets.length === 0) {
      return NextResponse.json(
        { error: "No active pets found" },
        { status: 404 },
      );
    }

    const userPetId = pets[0].id;

    // Verify match exists và user có quyền gửi message
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, pet_1_id, pet_2_id")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Kiểm tra pet của user có trong match không
    if (match.pet_1_id !== userPetId && match.pet_2_id !== userPetId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Tạo message mới
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        match_id: matchId,
        sender_pet_id: userPetId,
        content: content || null,
        image_url: imageUrl || null,
        is_read: false,
      })
      .select(
        `
        id,
        content,
        image_url,
        sender_pet_id,
        is_read,
        created_at,
        sender:pets!messages_sender_pet_id_fkey(id, name, avatar_url)
      `,
      )
      .single();

    if (messageError) {
      return NextResponse.json(
        { error: messageError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
