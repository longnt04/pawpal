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
        { error: "User not found" },
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
        { error: "Failed to update profile information" },
        { status: 500 },
      );
    }

    // 🔍 Check if user already has a pet
    const { data: existingPets, error: petCheckError } = await supabase
      .from("pets")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1);

    if (petCheckError) {
      console.error("Pet check error:", petCheckError);
      return NextResponse.json(
        { error: "Failed to verify existing pets" },
        { status: 500 },
      );
    }

    if (existingPets && existingPets.length > 0) {
      return NextResponse.json(
        {
          message:
            "Multiple pets feature will be available in a future update.",
        },
        { status: 400 },
      );
    }

    // 🐶 Add pet if none exists
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
        { error: "Failed to add pet" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Account setup completed successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "An error occurred during account setup" },
      { status: 500 },
    );
  }
}
