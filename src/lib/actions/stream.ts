"use server";

import { StreamClient } from "@stream-io/node-sdk";
import { createClient } from "@/lib/supabase/server";

export async function getStreamVideoToken() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // Get pet info for user
  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, avatar_url")
    .eq("owner_id", user.id)
    .single();

  if (!pet) {
    throw new Error("Pet not found");
  }

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
  const apiSecret = process.env.STREAM_SECRET_KEY!;

  const streamClient = new StreamClient(apiKey, apiSecret);

  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour from now
  const issued = Math.floor(Date.now() / 1000) - 60; // 1 minute ago

  const token = streamClient.generateUserToken({
    user_id: pet.id,
    exp,
    iat: issued,
  });

  return {
    token,
    userId: pet.id,
    userName: pet.name,
    userImage: pet.avatar_url,
  };
}
