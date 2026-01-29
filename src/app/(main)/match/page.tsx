"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  IoHeart,
  IoClose,
  IoArrowUndo,
  IoFilter,
  IoLocationOutline,
  IoArrowForward,
  IoArrowBack,
} from "react-icons/io5";
import { FaRegHeart } from "react-icons/fa";

interface Pet {
  id: string;
  name: string;
  breed: string;
  age: number;
  species: string;
  avatar_url: string | null;
  owner_id: string;
  bio?: string;
}

interface Match {
  id: string;
  pet_1_id: string;
  pet_2_id: string;
  created_at: string;
  pet?: Pet;
}

interface MatchRequest {
  id: string;
  from_pet_id: string;
  to_pet_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  pet?: Pet;
}

interface SwipeHistory {
  petId: string;
  action: "like" | "dislike" | "favorite";
}

export default function MatchPage() {
  const [currentUserPet, setCurrentUserPet] = useState<Pet | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistory[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [pendingRequests, setPendingRequests] = useState<MatchRequest[]>([]);
  const [petSwipeStatus, setPetSwipeStatus] = useState<
    Record<string, "like" | "dislike">
  >({});

  // Filters
  const [petTypeFilter, setPetTypeFilter] = useState<string>("dog");
  const [ageFilter, setAgeFilter] = useState<string[]>([]);
  const [distanceFilter, setDistanceFilter] = useState<number>(10);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentUserPet) {
      fetchPets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petTypeFilter, ageFilter, currentUserPet]);

  const getAgeCategory = (age: number): string => {
    if (age < 1) return "puppy";
    if (age < 3) return "young";
    if (age < 8) return "adult";
    return "senior";
  };

  const fetchRecentMatches = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userPets } = await supabase
        .from("pets")
        .select("id")
        .eq("owner_id", user.id);

      if (!userPets || userPets.length === 0) return;

      const petIds = userPets.map((p) => p.id);

      console.log("User pet IDs:", petIds);

      // Try simpler query first
      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (matchError) {
        console.error("Match query error:", matchError);
        return;
      }

      console.log("All matches in DB:", matches);

      // Filter matches that involve user's pets
      const userMatches = matches?.filter(
        (match) =>
          petIds.includes(match.pet_1_id) || petIds.includes(match.pet_2_id),
      );

      console.log("User's matches:", userMatches);

      if (userMatches && userMatches.length > 0) {
        const matchesWithPets = await Promise.all(
          userMatches.slice(0, 5).map(async (match) => {
            const otherPetId = petIds.includes(match.pet_1_id)
              ? match.pet_2_id
              : match.pet_1_id;
            const { data: pet } = await supabase
              .from("pets")
              .select("*")
              .eq("id", otherPetId)
              .single();
            return { ...match, pet };
          }),
        );
        console.log("Matches with pet info:", matchesWithPets);
        setRecentMatches(matchesWithPets);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userPets } = await supabase
        .from("pets")
        .select("id")
        .eq("owner_id", user.id);

      if (!userPets || userPets.length === 0) return;

      const petIds = userPets.map((p) => p.id);

      // Get pending match requests where user's pet is the receiver
      const { data: requests } = await supabase
        .from("match_requests")
        .select("*")
        .in("to_pet_id", petIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (requests && requests.length > 0) {
        const requestsWithPets = await Promise.all(
          requests.map(async (request) => {
            const { data: pet } = await supabase
              .from("pets")
              .select("*")
              .eq("id", request.from_pet_id)
              .single();
            return { ...request, pet };
          }),
        );
        setPendingRequests(requestsWithPets);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  };

  const handleAcceptMatch = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc("accept_match_request", {
        request_id: requestId,
      });

      if (error) throw error;

      toast.success("Đã chấp nhận match!");
      fetchPendingRequests();
      fetchRecentMatches();
    } catch (error: any) {
      console.error("Accept error:", error);
      toast.error("Không thể chấp nhận match");
    }
  };

  const handleRejectMatch = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("match_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Đã từ chối match");
      fetchPendingRequests();
    } catch (error: any) {
      console.error("Reject error:", error);
      toast.error("Không thể từ chối match");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vui lòng đăng nhập");
        return;
      }

      const { data: userPets } = await supabase
        .from("pets")
        .select("*")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .limit(1);

      if (!userPets || userPets.length === 0) {
        toast.error("Bạn chưa có thú cưng nào");
        setLoading(false);
        return;
      }

      setCurrentUserPet(userPets[0]);

      await Promise.all([fetchRecentMatches(), fetchPendingRequests()]);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const fetchPets = async () => {
    if (!currentUserPet) return;

    try {
      const { data: swipes } = await supabase
        .from("swipes")
        .select("to_pet_id, action")
        .eq("from_pet_id", currentUserPet.id);

      // Tạo map swipe status
      const swipeStatusMap: Record<string, "like" | "dislike"> = {};
      swipes?.forEach((s) => {
        if (s.action === "like" || s.action === "dislike") {
          swipeStatusMap[s.to_pet_id] = s.action;
        }
      });
      setPetSwipeStatus(swipeStatusMap);

      let query = supabase
        .from("pets")
        .select("*")
        .neq("owner_id", currentUserPet.owner_id)
        .eq("is_active", true);

      if (petTypeFilter !== "all") {
        query = query.eq("species", petTypeFilter);
      }

      const { data: availablePets, error } = await query;

      if (error) throw error;

      let filteredPets = availablePets || [];

      if (ageFilter.length > 0) {
        filteredPets = filteredPets.filter((pet) =>
          ageFilter.includes(getAgeCategory(pet.age)),
        );
      }

      setPets(filteredPets);
      setCurrentIndex(0);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Không thể tải dữ liệu");
    }
  };

  const handleSwipe = async (action: "like" | "dislike" | "favorite") => {
    if (!currentUserPet || !pets[currentIndex]) return;

    const targetPet = pets[currentIndex];

    try {
      const { error: swipeError } = await supabase.from("swipes").insert({
        from_pet_id: currentUserPet.id,
        to_pet_id: targetPet.id,
        action: action === "favorite" ? "like" : action,
      });

      if (swipeError) throw swipeError;

      setSwipeHistory([
        ...swipeHistory,
        { petId: targetPet.id, action: action },
      ]);

      // Cập nhật swipe status
      setPetSwipeStatus({
        ...petSwipeStatus,
        [targetPet.id]: action === "favorite" ? "like" : action,
      });

      if (action === "like" || action === "favorite") {
        toast.success(`Đã gửi lời mời kết bạn đến ${targetPet.name}!`);
      }

      if (action === "favorite") {
        toast.success(`⭐ Đã lưu ${targetPet.name} vào yêu thích!`);
      }
    } catch (error: any) {
      console.error("Swipe error:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleUndo = () => {
    if (currentIndex === 0) return;
    setCurrentIndex(currentIndex - 1);
  };

  const toggleAgeFilter = (category: string) => {
    if (ageFilter.includes(category)) {
      setAgeFilter(ageFilter.filter((c) => c !== category));
    } else {
      setAgeFilter([...ageFilter, category]);
    }
  };

  const currentPet = pets[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Filters */}
          <div className="lg:col-span-3 hidden lg:block">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                <IoFilter className="text-pink-500" />
                Filters
              </h2>

              {/* Pet Type Filter */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Pet Type
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    { value: "dog", label: "Dogs" },
                    { value: "cat", label: "Cats" },
                    { value: "other", label: "Others" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setPetTypeFilter(type.value)}
                      className={`px-4 py-3 rounded-xl font-medium transition-all ${
                        petTypeFilter === type.value
                          ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Distance Filter */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Distance
                </label>
                <select
                  value={distanceFilter}
                  onChange={(e) => setDistanceFilter(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-pink-500"
                >
                  <option value={5}>Within 5 miles</option>
                  <option value={10}>Within 10 miles</option>
                  <option value={20}>Within 20 miles</option>
                  <option value={50}>Within 50 miles</option>
                </select>
              </div>

              {/* Age Filter */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Age
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "puppy", label: "<1 yrs" },
                    { value: "young", label: "1-3 yrs" },
                    { value: "adult", label: "3-8 yrs" },
                    { value: "senior", label: "8+ yrs" },
                  ].map((age) => (
                    <button
                      key={age.value}
                      onClick={() => toggleAgeFilter(age.value)}
                      className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                        ageFilter.includes(age.value)
                          ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {age.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  setPetTypeFilter("dog");
                  setAgeFilter([]);
                  setDistanceFilter(10);
                }}
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Center Column - Main Pet Card */}
          <div className="lg:col-span-6">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                Find Your Pet's New Friend
              </h1>
              <p className="text-gray-600">
                Swipe to find the perfect match for your pet
              </p>
            </div>

            {!currentPet ? (
              <div className="text-center py-20">
                <h2 className="text-3xl font-bold text-gray-800 mb-3">
                  No More Pets!
                </h2>
                <p className="text-gray-600 mb-6 text-lg">
                  You've seen all available pets with current filters
                </p>
                <button
                  onClick={fetchData}
                  className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-semibold hover:from-pink-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
                >
                  Reload
                </button>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                {/* Pet Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-8">
                  {/* Pet Image */}
                  <div className="relative h-[500px] bg-gradient-to-br from-gray-200 to-gray-300">
                    {currentPet.avatar_url ? (
                      <img
                        src={currentPet.avatar_url}
                        alt={currentPet.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-9xl">
                        {currentPet.species === "dog"
                          ? "🐕"
                          : currentPet.species === "cat"
                            ? "🐈"
                            : "🐾"}
                      </div>
                    )}
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

                    {/* Swipe Status Badge */}
                    {petSwipeStatus[currentPet.id] && (
                      <div
                        className={`absolute top-8 right-8 px-6 py-3 rounded-2xl border-4 font-black text-3xl rotate-12 ${
                          petSwipeStatus[currentPet.id] === "like"
                            ? "border-green-500 text-green-500"
                            : "border-red-500 text-red-500"
                        }`}
                      >
                        {petSwipeStatus[currentPet.id] === "like"
                          ? "LIKE"
                          : "NOPE"}
                      </div>
                    )}

                    {/* Pet Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <h2 className="text-4xl font-bold mb-2">
                        {currentPet.name}{" "}
                        <span className="text-3xl font-light">
                          · {currentPet.age} yrs
                        </span>
                      </h2>
                      <p className="text-xl text-gray-100 mb-2">
                        {currentPet.breed}
                      </p>
                      <p className="flex items-center gap-1 text-gray-200">
                        <IoLocationOutline className="text-lg" />
                        {distanceFilter} miles away
                      </p>
                    </div>
                  </div>

                  {/* Pet Bio */}
                  <div className="p-6 bg-gradient-to-br from-gray-50 to-white">
                    <p className="text-gray-700 text-center line-clamp-2">
                      {currentPet.bio ?? "..."}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-6">
                  {/* Dislike Button */}
                  <button
                    onClick={() => handleSwipe("dislike")}
                    disabled={!!petSwipeStatus[currentPet.id]}
                    className={`group w-16 h-16 rounded-full bg-white border-2 flex items-center justify-center transition-all shadow-lg ${
                      petSwipeStatus[currentPet.id]
                        ? "border-gray-300 cursor-not-allowed opacity-50"
                        : "border-red-400 hover:bg-red-50 hover:shadow-xl hover:scale-110"
                    }`}
                  >
                    <IoClose className={`text-4xl transition-transform ${
                      petSwipeStatus[currentPet.id]
                        ? "text-gray-400"
                        : "text-red-500 group-hover:scale-125"
                    }`} />
                  </button>

                  <button
                    onClick={() => {
                      if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                    }}
                    className="group w-16 h-16 rounded-full bg-white border-2 border-blue-400 hover:bg-blue-50 flex items-center justify-center transition-all shadow-lg hover:shadow-xl hover:scale-110"
                  >
                    <IoArrowBack className="text-4xl text-blue-500 group-hover:scale-125 transition-transform" />
                  </button>

                  {/* Like Button */}
                  <button
                    onClick={() => handleSwipe("like")}
                    disabled={!!petSwipeStatus[currentPet.id]}
                    className={`group w-16 h-16 rounded-full bg-white border-2 flex items-center justify-center transition-all ${
                      petSwipeStatus[currentPet.id]
                        ? "border-gray-300 cursor-not-allowed opacity-50 shadow-lg"
                        : "border-red-400 hover:bg-red-50 shadow-xl hover:shadow-2xl hover:scale-110"
                    }`}
                  >
                    <FaRegHeart className={`text-4xl transition-transform ${
                      petSwipeStatus[currentPet.id]
                        ? "text-gray-400"
                        : "text-red-500 group-hover:scale-125"
                    }`} />
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={() => {
                      if (currentIndex < pets.length - 1)
                        setCurrentIndex(currentIndex + 1);
                    }}
                    className="group w-16 h-16 rounded-full bg-white border-2 border-blue-400 hover:bg-blue-50 flex items-center justify-center transition-all shadow-lg hover:shadow-xl hover:scale-110"
                  >
                    <IoArrowForward className="text-4xl text-blue-500 group-hover:scale-125 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Recent Matches */}
          <div className="lg:col-span-3 hidden lg:block">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24 space-y-6">
              {/* Pending Match Requests */}
              {pendingRequests.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    Match Requests
                  </h2>
                  <div className="space-y-3 mb-6">
                    {pendingRequests.slice(0, 3).map((request) => (
                      <div
                        key={request.id}
                        className="p-3 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border border-pink-200"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {request.pet?.avatar_url ? (
                              <img
                                src={request.pet.avatar_url}
                                alt={request.pet.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xl">
                                {request.pet?.species === "dog" ? "🐕" : "🐈"}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-800 truncate">
                              {request.pet?.name || "Unknown"}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                              muốn kết bạn
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptMatch(request.id)}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition"
                          >
                            Chấp nhận
                          </button>
                          <button
                            onClick={() => handleRejectMatch(request.id)}
                            className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-lg transition"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Matches */}
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Recent Matches
                </h2>

                {recentMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-3">💕</div>
                    <p className="text-gray-500 text-sm">
                      No matches yet.
                      <br />
                      Start swiping!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentMatches.map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {match.pet?.avatar_url ? (
                            <img
                              src={match.pet.avatar_url}
                              alt={match.pet.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">
                              {match.pet?.species === "dog" ? "🐕" : "🐈"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 truncate">
                            {match.pet?.name || "Unknown"}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">
                            {match.pet?.breed || "Unknown breed"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {recentMatches.length > 0 && (
                  <button className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg">
                    View All Matches
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
