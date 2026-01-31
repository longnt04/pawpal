import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json(
        { error: "Match ID is required" },
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

    // Verify user có quyền truy cập match này không
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select(
        `
        id,
        pet_1_id,
        pet_2_id,
        pet_1:pets!matches_pet_1_id_fkey(id, owner_id),
        pet_2:pets!matches_pet_2_id_fkey(id, owner_id)
      `,
      )
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Kiểm tra user có sở hữu 1 trong 2 pets không
    const hasAccess =
      match.pet_1.owner_id === user.id || match.pet_2.owner_id === user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Lấy tất cả messages của match
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
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
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
