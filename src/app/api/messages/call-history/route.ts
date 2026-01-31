import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchId, callType, duration } = await request.json();

    if (!matchId || !callType || duration === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get user's pet
    const { data: pet } = await supabase
      .from("pets")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!pet) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    // Format duration
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    let durationText = "";
    if (minutes > 0) {
      durationText = `${minutes}min`;
      if (seconds > 0) {
        durationText += ` ${seconds}s`;
      }
    } else {
      durationText = `${seconds}s`;
    }

    // Create call history message
    const callMessage = `${callType === "video" ? "Video call" : "Voice call"} - ${durationText}`;

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        match_id: matchId,
        sender_pet_id: pet.id,
        content: callMessage,
        image_url: null,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Error saving call history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
