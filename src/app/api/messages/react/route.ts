import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { messageId, reaction } = await request.json();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already reacted
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("id, reaction")
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // If same reaction, remove it (toggle off)
      if (existing.reaction === reaction) {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
        return NextResponse.json({ success: true, removed: true });
      } else {
        // Update to new reaction
        const { error } = await supabase
          .from("message_reactions")
          .update({ reaction })
          .eq("id", existing.id);

        if (error) throw error;
        return NextResponse.json({ success: true, updated: true });
      }
    } else {
      // Add new reaction
      const { error } = await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        reaction,
      });

      if (error) throw error;
      return NextResponse.json({ success: true, added: true });
    }
  } catch (error) {
    console.error("Error handling reaction:", error);
    return NextResponse.json(
      { error: "Failed to handle reaction" },
      { status: 500 },
    );
  }
}
