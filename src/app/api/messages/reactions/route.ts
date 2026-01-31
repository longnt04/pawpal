import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json({ error: "Match ID required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get reactions for all messages in this match
    const { data: messages } = await supabase
      .from("messages")
      .select("id")
      .eq("match_id", matchId);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ reactions: {} });
    }

    const messageIds = messages.map((m) => m.id);

    const { data: reactions, error } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, reaction")
      .in("message_id", messageIds);

    if (error) throw error;

    // Group reactions by message_id
    const reactionsByMessage: Record<
      string,
      Array<{ user_id: string; reaction: string }>
    > = {};

    reactions?.forEach((r) => {
      if (!reactionsByMessage[r.message_id]) {
        reactionsByMessage[r.message_id] = [];
      }
      reactionsByMessage[r.message_id].push({
        user_id: r.user_id,
        reaction: r.reaction,
      });
    });

    return NextResponse.json({ reactions: reactionsByMessage });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch reactions" },
      { status: 500 },
    );
  }
}
