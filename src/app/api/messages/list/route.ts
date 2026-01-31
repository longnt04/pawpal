import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const matchId = searchParams.get("matchId");
    const limit = parseInt(searchParams.get("limit") || "30");
    const before = searchParams.get("before"); // ISO timestamp

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
    const pet1 = Array.isArray(match.pet_1) ? match.pet_1[0] : match.pet_1;
    const pet2 = Array.isArray(match.pet_2) ? match.pet_2[0] : match.pet_2;

    const hasAccess = pet1?.owner_id === user.id || pet2?.owner_id === user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Lấy tất cả messages của match
    let query = supabase
      .from("messages")
      .select(
        `
        id,
        content,
        image_url,
        sender_pet_id,
        reply_to_message_id,
        is_read,
        created_at,
        sender:pets!messages_sender_pet_id_fkey(id, name, avatar_url)
      `,
      )
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Thêm filter theo before nếu có
    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 },
      );
    }

    // Load replied messages separately (can't use nested select for self-referencing)
    const messageIds =
      messages
        ?.filter((m) => m.reply_to_message_id)
        .map((m) => m.reply_to_message_id) || [];

    let repliedMessagesMap: Record<string, any> = {};

    if (messageIds.length > 0) {
      const { data: repliedMessages } = await supabase
        .from("messages")
        .select(
          `
          id,
          content,
          image_url,
          sender_pet_id,
          sender:pets!messages_sender_pet_id_fkey(name)
        `,
        )
        .in("id", messageIds);

      if (repliedMessages) {
        repliedMessages.forEach((rm) => {
          repliedMessagesMap[rm.id] = {
            ...rm,
            sender: Array.isArray(rm.sender) ? rm.sender[0] : rm.sender,
          };
        });
      }
    }

    // Map replied messages back to messages
    const messagesWithReplies = messages?.map((msg) => ({
      ...msg,
      sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
      replied_message: msg.reply_to_message_id
        ? repliedMessagesMap[msg.reply_to_message_id] || null
        : null,
    }));

    // Reverse to ascending order
    const sortedMessages = messagesWithReplies?.reverse() || [];

    return NextResponse.json({ messages: sortedMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
