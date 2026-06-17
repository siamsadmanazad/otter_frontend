"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useCommentApi, useFeedAPI, useLikeApi, useUserApi } from "@/lib/requests";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { IPostProps } from "@/types/post";
import { GridMedia } from "../shared/grid-media";
import { toast } from "sonner";
import { PostDialog } from "../shared/post-dialog";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CommentBox } from "../shared/comment-box";
import { Socket } from "socket.io-client";

const POSTS_PER_PAGE = 3;

export function PostCard({
  post,
  session,
  socket,
  isSocketConnected,
}: {
  post: IPostProps;
  session: any;
  socket: Socket<any, any>;
  isSocketConnected: boolean;
}) {
  const currentLoggedInUser = session?.user;
  const queryClient = useQueryClient();

  const createNotification = async (
    content: string,
    type: string,
    postUrl: string
  ) => {
    console.log("trigger create notification");
    if (
      !post?.owner?._id ||
      !currentUserProfile?.data?.profile?._id
    ) {
      console.log(" one of the required params were missing to invoke a notification ");
      console.log(
        isSocketConnected,
        post?.owner?._id,
        currentUserProfile?.data?.profile?._id
      );
      return;
    }
    try {
      if (post.owner._id !== currentUserProfile?.data?.profile?._id) {
        socket.emit("createNotification", {
          createdBy: currentUserProfile?.data?.profile?._id,
          receiver: post.owner._id,
          content,
          type,
          postUrl,
          isRead: false,
        });
        console.log('created notification', {
          createdBy: currentUserProfile?.data?.profile?._id,
          receiver: post.owner._id,
          content,
          type,
          postUrl,
          isRead: false,
        });
      }
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  const { data: currentUserProfile, isLoading: isUserLoading } = useQuery({
    queryKey: ["currentUserProfile", currentLoggedInUser?.id],
    queryFn: async () => {
      if (!currentLoggedInUser?.id) return null;
      const response = await useUserApi.getUser(currentLoggedInUser.id);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to fetch user profile.");
      }
      return response;
    },
    enabled: !!currentLoggedInUser?.id,
    staleTime: 1000 * 60 * 100, // 100 minutes cache time
  });
  const userImage =
    currentUserProfile?.data?.profileImage ?? currentLoggedInUser?.image;

  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>(
    {}
  );
  const [displayedComments, setDisplayedComments] = useState(post.comments);
  const [isLiked, setIsLiked] = useState(
    currentLoggedInUser
      ? post.likes.some(
          (like) => like.username === currentLoggedInUser.username
        )
      : false
  );
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [editingComment, setEditingComment] = useState<{
    commentId: string;
    commentIndex: number;
    originalText: string;
  } | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  const likeMutation = useMutation({
    mutationFn: async () => useLikeApi.likePost(post._id),
    onMutate: async () => {
      const previousIsLiked = isLiked;
      const previousLikesCount = likesCount;
      setIsLiked((prev) => !prev);
      setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));
      createNotification(
        "liked your profile",
        "LIKE",
        `/post/${post._id}`
      );
      return { previousIsLiked, previousLikesCount };
    },
    onError: (err, variables, context) => {
      setIsLiked(context?.previousIsLiked || false);
      setLikesCount(context?.previousLikesCount || 0);
      toast.error(
        `Failed to update like status: ${
          (err as any).message || "Unknown error"
        }`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (newCommentText: string) =>
      useCommentApi.createComment(post._id, newCommentText),
    onMutate: async (newCommentText) => {
      const newTempComment = {
        _id: `temp-${Date.now()}`,
        content: newCommentText,
        owner: {
          _id: currentLoggedInUser?.id || "",
          username: currentLoggedInUser?.username || "",
          profileImage: currentLoggedInUser?.image || "",
        },
        createdAt: dayjs().toISOString(),
      };
      setDisplayedComments((prev) => [...prev, newTempComment]);
      setCommentInputs((prev) => ({ ...prev, [post._id]: "" }));
      return newTempComment;
    },
    onSuccess: (response, variables, context) => {
      if (response.status === 200 && response.data) {
        createNotification(
        "commented on your post",
        "COMMENT",
        `/post/${post._id}`
        );
        setDisplayedComments((prev) =>
          prev.map((comment) =>
            comment._id === context?._id
              ? {
                  ...response.data,
                  owner: response.data.owner || context?.owner,
                }
              : comment
          )
        );
      } else {
        setDisplayedComments((prev) =>
          prev.filter((comment) => comment._id !== context?._id)
        );
        toast.error(response.message || "Failed to add comment.");
      }
    },
    onError: (err, variables, context) => {
      setDisplayedComments((prev) =>
        prev.filter((comment) => comment._id !== context?._id)
      );
      toast.error(
        `Failed to add comment: ${(err as any).message || "Unknown error"}`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      newContent,
    }: {
      commentId: string;
      newContent: string;
    }) => useCommentApi.updateComment(commentId, newContent),
    onMutate: async ({ commentId, newContent }) => {
      const previousComments = displayedComments;
      setDisplayedComments((prev) =>
        prev.map((comment) =>
          comment._id === commentId
            ? { ...comment, content: newContent, edited: true }
            : comment
        )
      );
      setEditingComment(null);
      setEditCommentText("");
      createNotification(
        "updated comment on your post",
        "COMMENT",
        `/post/${post._id}`
      );
      return { previousComments };
    },
    onError: (err, variables, context) => {
      setDisplayedComments(context?.previousComments || []);
      toast.error(
        `Failed to update comment: ${(err as any).message || "Unknown error"}`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) =>
      useCommentApi.deleteComment(commentId),
    onMutate: async (commentId) => {
      const previousComments = displayedComments;
      setDisplayedComments((prev) =>
        prev.filter((comment) => comment._id !== commentId)
      );
      return { previousComments };
    },
    onError: (err, variables, context) => {
      setDisplayedComments(context?.previousComments || []);
      toast.error(
        `Failed to delete comment: ${(err as any).message || "Unknown error"}`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
    },
  });

  const toggleComments = (postId: string) => {
    setShowComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleCommentInputChange = (postId: string, value: string) => {
    setCommentInputs((prev) => ({
      ...prev,
      [postId]: value,
    }));
  };

  const handleAddComment = async (postId: string) => {
    const newCommentText = commentInputs[postId]?.trim();
    if (newCommentText && currentLoggedInUser) {
      addCommentMutation.mutate(newCommentText);
    } else if (!newCommentText) {
      toast.error("Comment cannot be empty.");
    } else if (!currentLoggedInUser) {
      toast.error("You must be logged in to add a comment.");
    }
  };

  const handleLike = () => {
    if (!currentLoggedInUser) {
      toast.error("You must be logged in to like a post.");
      return;
    }
    likeMutation.mutate();
  };

  const handleEditComment = (
    commentId: string,
    index: number,
    text: string
  ) => {
    setEditingComment({ commentId, commentIndex: index, originalText: text });
    setEditCommentText(text);
  };

  const handleSaveEdit = () => {
    if (editingComment) {
      const { commentId, originalText } = editingComment;
      const newContent = editCommentText.trim();

      if (!newContent) {
        toast.error("Comment cannot be empty.");
        return;
      }

      if (newContent === originalText) {
        toast.info("No changes made to the comment.");
        setEditingComment(null);
        setEditCommentText("");
        return;
      }

      updateCommentMutation.mutate({ commentId, newContent });
    }
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditCommentText("");
  };

  const handleDeleteComment = (commentId: string, index: number) => {
    deleteCommentMutation.mutate(commentId);
  };

  return (
    <Card
      key={post._id}
      className="border-0 border-b md:border rounded-none md:rounded-lg shadow-none md:shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700"
    >
      <div className="flex items-center justify-between p-3 md:p-4">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post?.owner?._id}`}>
            <Avatar className="w-8 h-8 md:w-10 md:h-10">
              <AvatarImage
                src={post?.owner?.profileImage || "/placeholder.svg"}
                alt={post?.owner?.username}
              />
              <AvatarFallback className="dark:bg-gray-700 dark:text-gray-300">
                {post?.owner?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link href={`/profile/${post?.owner?._id}`}>
              <span className="font-semibold text-sm md:text-base text-gray-900 dark:text-gray-100">
                @{post?.owner?.username}
              </span>
            </Link>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {dayjs(post.createdAt).fromNow()}
              {post?.location && ` • ${post?.location}`}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="dark:bg-gray-700 dark:border-gray-600"
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <PostDialog
                post={{ _caption: post.caption, _location: post.location }}
                id={post._id}
                type={"EDIT"}
              >
                <span>Edit Post</span>
              </PostDialog>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <PostDialog id={post._id} type={"DELETE"}>
                <span className="text-red-600">Delete Post</span>
              </PostDialog>
            </DropdownMenuItem>
            <DropdownMenuItem className="dark:text-gray-100 dark:hover:bg-gray-600">
              <Link
                href={`/post/${post._id}?caption=${post.caption
                  .split(/ /g)
                  .slice(0, 8)
                  .join("-")}`}
                className="w-full"
              >
                Show post
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="ml-6 text-gray-800 dark:text-gray-200">
        {post.caption}
      </div>
      {post.image && post.image.length > 0 && (
        <CardContent className="p-4">
          <GridMedia media={post.image} />
        </CardContent>
      )}
      <div className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 p-0 dark:text-gray-400 dark:hover:bg-gray-700"
              onClick={handleLike}
              disabled={likeMutation.isPending}
            >
              <Heart
                className={`w-6 h-6 ${
                  isLiked
                    ? "fill-red-500 text-red-500"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 p-0 dark:text-gray-400 dark:hover:bg-gray-700"
              onClick={() => toggleComments(post._id)}
            >
              <MessageCircle className="w-6 h-6" />
            </Button>
            {/* <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 p-0 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <Send className="w-6 h-6" />
            </Button> */}
          </div>
          {/* <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 p-0 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Bookmark className="w-6 h-6" />
          </Button> */}
        </div>

        <div className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">
          {likesCount.toLocaleString()} likes
        </div>

        <div className="space-y-1">
          {displayedComments.map((comment, index) => (
            <div
              key={comment._id || `initial-comment-${index}`}
              className="text-sm group text-gray-800 dark:text-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="font-semibold mr-2 dark:text-gray-100">
                    {comment.owner?.username || session?.user?.username}
                  </span>
                  {editingComment?.commentId === comment._id &&
                  editingComment?.commentIndex === index ? (
                    <div className="mt-1">
                      <input
                        type="text"
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-600"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-1">
                        <Button
                          onClick={handleSaveEdit}
                          size="sm"
                          className="h-6 px-2 text-xs dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white"
                          disabled={updateCommentMutation.isPending}
                        >
                          {updateCommentMutation.isPending
                            ? "Saving..."
                            : "Save"}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs bg-transparent dark:bg-transparent dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                          disabled={updateCommentMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {comment.content}
                      {(comment as any).edited && (
                        <span className="text-xs text-gray-400 ml-1 dark:text-gray-500">
                          (edited)
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-2 dark:text-gray-500">
                        {dayjs(comment.createdAt).fromNow()}
                      </span>
                    </>
                  )}
                </div>
                {currentLoggedInUser &&
                  comment.owner?.username === currentLoggedInUser.username &&
                  !(
                    editingComment?.commentId === comment._id &&
                    editingComment?.commentIndex === index
                  ) && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 dark:text-gray-400 hover:dark:bg-gray-700"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="dark:bg-gray-700 dark:border-gray-600"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              handleEditComment(
                                comment._id,
                                index,
                                comment.content
                              )
                            }
                            className="dark:text-gray-100 dark:hover:bg-gray-600"
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleDeleteComment(comment._id, index)
                            }
                            className="text-red-600 dark:text-red-400 dark:hover:bg-gray-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
              </div>
            </div>
          ))}

          {showComments[post._id] && (
            <CommentBox
              postId={post._id}
              currentLoggedInUser={currentLoggedInUser}
              commentInputs={commentInputs}
              handleCommentInputChange={handleCommentInputChange}
              handleAddComment={handleAddComment}
              addCommentMutation={addCommentMutation}
              userImage={userImage}
            />
          )}

          {!showComments[post._id] && displayedComments.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleComments(post._id)}
              className="text-xs text-gray-500 mt-1 h-auto p-0 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              View all {displayedComments.length} comments
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
