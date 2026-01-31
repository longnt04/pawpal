"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { IoHeart, IoChatbubbles, IoShareSocial, IoSend } from "react-icons/io5";
import toast from "react-hot-toast";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
  users: {
    full_name: string;
    avatar_url?: string;
  };
  replies?: Comment[];
}

interface PostCardProps {
  post: any;
  onPostUpdate?: () => void;
}

export default function PostCard({ post, onPostUpdate }: PostCardProps) {
  const supabase = createClient();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [shareCount] = useState(0); // Static for now
  const [comments, setComments] = useState<Comment[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loadingComment, setLoadingComment] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const replyFormRef = useRef<HTMLDivElement>(null);

  const pet = post.pets;
  const DEFAULT_COMMENTS_LIMIT = 5;

  useEffect(() => {
    loadPostData();
    getCurrentUser();
  }, [post.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        replyFormRef.current &&
        !replyFormRef.current.contains(event.target as Node)
      ) {
        setReplyingTo(null);
        setReplyContent("");
      }
    };

    if (replyingTo) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [replyingTo]);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadPostData = async () => {
    // Load like status and count
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: likeData } = await supabase
        .from("post_likes")
        .select("*")
        .eq("post_id", post.id)
        .eq("user_id", user.id)
        .single();

      setIsLiked(!!likeData);
    }

    // Load like count
    const { count: likes } = await supabase
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);

    setLikeCount(likes || 0);

    // Load comments
    await loadComments();
  };

  const loadComments = async () => {
    const { data: commentsData, count } = await supabase
      .from("post_comments")
      .select("*", { count: "exact" })
      .eq("post_id", post.id)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: true })
      .limit(showAllComments ? 1000 : DEFAULT_COMMENTS_LIMIT);

    if (commentsData) {
      const commentUserIds = [...new Set(commentsData.map((c) => c.user_id))];
      const { data: commentUsers } = await supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .in("id", commentUserIds);

      const commentUsersMap = new Map(
        commentUsers?.map((u) => [u.id, u]) || [],
      );

      // Load replies for each comment
      const commentsWithReplies = await Promise.all(
        commentsData.map(async (comment) => {
          const { data: replies } = await supabase
            .from("post_comments")
            .select("*")
            .eq("parent_comment_id", comment.id)
            .order("created_at", { ascending: true });

          let repliesWithUsers = [];
          if (replies && replies.length > 0) {
            const replyUserIds = [...new Set(replies.map((r) => r.user_id))];
            const { data: replyUsers } = await supabase
              .from("users")
              .select("id, full_name, avatar_url")
              .in("id", replyUserIds);

            const replyUsersMap = new Map(
              replyUsers?.map((u) => [u.id, u]) || [],
            );
            repliesWithUsers = replies.map((reply) => ({
              ...reply,
              users: replyUsersMap.get(reply.user_id),
            }));
          }

          return {
            ...comment,
            users: commentUsersMap.get(comment.user_id),
            replies: repliesWithUsers,
          };
        }),
      );

      setComments(commentsWithReplies);
      setCommentCount(count || 0);
    }
  };

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    if (isLiked) {
      // Unlike
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);

      setIsLiked(false);
      setLikeCount((prev) => prev - 1);
    } else {
      // Like
      await supabase
        .from("post_likes")
        .insert({ post_id: post.id, user_id: currentUserId });

      setIsLiked(true);
      setLikeCount((prev) => prev + 1);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    if (!newComment.trim()) {
      toast.error("Vui lòng nhập nội dung bình luận");
      return;
    }

    setLoadingComment(true);

    try {
      const { error } = await supabase.from("post_comments").insert({
        post_id: post.id,
        user_id: currentUserId,
        content: newComment.trim(),
      });

      if (error) throw error;

      setNewComment("");
      await loadComments();
      toast.success("Đã thêm bình luận");
    } catch (error) {
      console.error("Comment error:", error);
      toast.error("Không thể thêm bình luận");
    } finally {
      setLoadingComment(false);
    }
  };

  const handleReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();

    if (!currentUserId) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    if (!replyContent.trim()) {
      toast.error("Vui lòng nhập nội dung trả lời");
      return;
    }

    setLoadingComment(true);

    try {
      const { error } = await supabase.from("post_comments").insert({
        post_id: post.id,
        user_id: currentUserId,
        content: replyContent.trim(),
        parent_comment_id: parentId,
      });

      if (error) throw error;

      setReplyContent("");
      setReplyingTo(null);
      await loadComments();
      toast.success("Đã trả lời");
    } catch (error) {
      console.error("Reply error:", error);
      toast.error("Không thể trả lời");
    } finally {
      setLoadingComment(false);
    }
  };

  const handleLoadMore = async () => {
    setShowAllComments(true);
    await loadComments();
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} days ago`;
    }
  };

  console.log(comments);

  return (
    <div className="mb-6 bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Pet Info Header */}
      <div className="p-4 flex items-center gap-3 border-b border-gray-200">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
          {pet?.avatar_url ? (
            <img
              src={pet.avatar_url}
              alt={pet.name}
              className="w-full h-full object-cover"
            />
          ) : (
            pet?.name?.[0] || "P"
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">{pet?.name || "Pet"}</h3>
          <p className="text-sm text-gray-600">{getTimeAgo(post.created_at)}</p>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="p-4">
          <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <div className="bg-gradient-to-br from-pink-100 to-purple-100 overflow-hidden">
          <img
            src={post.images[0]}
            alt="Post"
            className="w-full h-auto max-h-96 object-cover"
          />
        </div>
      )}

      {/* Interaction Summary */}
      <div className="px-4 py-2 flex items-center gap-4 text-sm text-gray-600">
        <span>{likeCount} Likes</span>
        <span>·</span>
        <span>{commentCount} Comments</span>
        {shareCount > 0 && (
          <>
            <span>·</span>
            <span>{shareCount} Shares</span>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 border-t border-b border-gray-200 flex items-center gap-6">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 transition hover:bg-pink-50 px-3 py-1 rounded-lg ${
            isLiked ? "text-pink-500" : "text-gray-600"
          }`}
        >
          <IoHeart className={`text-xl ${isLiked ? "fill-current" : ""}`} />
          <span className="text-sm font-medium">
            {isLiked ? "Liked" : "Like"}
          </span>
        </button>
        <button
          onClick={() =>
            document.getElementById(`comment-input-${post.id}`)?.focus()
          }
          className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-1 rounded-lg transition"
        >
          <IoChatbubbles className="text-xl" />
          <span className="text-sm font-medium">Comment</span>
        </button>
        <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-1 rounded-lg transition">
          <IoShareSocial className="text-xl" />
          <span className="text-sm font-medium">Share</span>
        </button>
      </div>

      {/* Comments Section */}
      <div className="px-4 py-3">
        {/* Comments List */}
        {comments.length > 0 && (
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id}>
                <div className="flex gap-2">
                  <div className="w-8 h-8 mt-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                    {comment.users?.avatar_url ? (
                      <img
                        src={comment.users.avatar_url}
                        alt={comment.users.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={"/default-avatar.png"}
                        alt={comment.users.full_name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-lg pr-3 py-2">
                      <p className="font-semibold text-sm text-gray-900">
                        {comment.users?.full_name || "User"}
                      </p>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-3 text-xs text-gray-500">
                      <span>{getTimeAgo(comment.created_at)}</span>
                      <button
                        onClick={() =>
                          setReplyingTo(
                            replyingTo === comment.id ? null : comment.id,
                          )
                        }
                        className="hover:text-gray-400 font-medium"
                      >
                        Reply
                      </button>
                    </div>

                    {/* Reply Input */}
                    {replyingTo === comment.id && (
                      <div ref={replyFormRef}>
                        <form
                          onSubmit={(e) => handleReply(e, comment.id)}
                          className="flex gap-2 mt-2"
                        >
                          <input
                            type="text"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Viết câu trả lời..."
                            id={`reply-input-${comment.id}`}
                            className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-full text-sm text-white placeholder-gray-500"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={loadingComment || !replyContent.trim()}
                            className="px-4 py-2 text-white rounded-full disabled:cursor-not-allowed"
                          >
                            <IoSend />
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Replies
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 space-y-2 ml-4 border-l-2 border-gray-200 pl-3">>
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                              {reply.users?.avatar_url ? (
                                <img src={reply.users.avatar_url} alt={reply.users.full_name} className="w-full h-full object-cover" />
                              ) : (
                                reply.users?.full_name?.[0] || "U"
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="bg-gray-100 rounded-lg px-2 py-1.5">
                                <p className="font-semibold text-xs text-gray-900">
                                  {reply.users?.full_name || "User"}
                                </p>
                                <p className="text-xs text-gray-700">{reply.content}</p>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 ml-2">
                                {getTimeAgo(reply.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )} */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Comments */}
        {!showAllComments && commentCount > DEFAULT_COMMENTS_LIMIT && (
          <button
            onClick={handleLoadMore}
            className="text-sm text-gray-400 hover:text-gray-300 mb-3"
          >
            Load more comments ({commentCount - DEFAULT_COMMENTS_LIMIT} remaining)
          </button>
        )}

        {/* Comment Input */}
        <form onSubmit={handleComment} className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
            <img
              src="/default-avatar.png"
              alt="User"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 flex gap-2">
            <input
              id={`comment-input-${post.id}`}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Viết bình luận..."
              className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-pink-400"
              disabled={loadingComment}
            />
            <button
              type="submit"
              disabled={loadingComment || !newComment.trim()}
              className="px-4 py-2 bg-gradient-to-r  text-white rounded-full  disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IoSend />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
