"use client";

import { useState } from "react";
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
import {
  useCommentApi,
  useLikeApi,
} from "@/lib/requests";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { IPostProps } from "@/types/post";
import { GridMedia } from "../shared/grid-media";
import { toast } from "sonner";
import { ReportModal } from "../shared/report-modal";
import { User } from "../shared/user";
import { Socket } from "socket.io-client";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { CommentBox } from "../shared/comment-box";

export function PostCardV2({
  post,
  currentUserProfile,
  userImage,
  session,
  socket,
  isSocketConnected,
}: {
  post: IPostProps;
  currentUserProfile: any;
  userImage: any
  session: {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
      username: string;
    };
  } | null;
  socket: Socket<any, any>;
  isSocketConnected: boolean;
}) {
  const currentLoggedInUser = session?.user;
  const queryClient = useQueryClient();

  // const { data: currentUserProfile, isLoading: isUserLoading } = useQuery({
  //   queryKey: ["currentUserProfile", currentLoggedInUser?.id],
  //   queryFn: async () => {
  //     if (!currentLoggedInUser?.id) return null;
  //     const response = await useUserApi.getUser(currentLoggedInUser.id);
  //     if (response.status !== 200) {
  //       throw new Error(response.message || "Failed to fetch user profile.");
  //     }
  //     return response;
  //   },
  //   enabled: !!currentLoggedInUser?.id,
  //   staleTime: 1000 * 60 * 100,
  // });

  // const userImage =
  //   currentUserProfile?.data?.profileImage ?? currentLoggedInUser?.image;

  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>(
    {}
  );
  const [showAllComments, setShowAllComments] = useState(false);

  const commentsToDisplay = showAllComments
    ? post.comments
    : post.comments.slice(0, 4);

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

  const createNotification = async (
    content: string,
    type: string,
    postUrl: string
  ) => {
    console.log("trigger create notification");
    if (!post?.owner?._id || !currentUserProfile?.data?.profile?._id) {
      console.log(
        " one of the required params were missing to invoke a notification "
      );
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
      }
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  const addCommentMutation = useMutation({
    mutationFn: async ({
      postId,
      content,
    }: {
      postId: string;
      content: string;
    }) => {
      const response = await useCommentApi.createComment(postId, content);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to add comment.");
      }
      return response.data;
    },
    // Optimistic update
    onMutate: async ({ postId, content }) => {
      await queryClient.cancelQueries({ queryKey: ["homeFeed"] });

      // Create a temporary comment object for the immediate UI update
      const temporaryComment = {
        _id: `temp-${Date.now()}`,
        content,
        owner: {
          _id: currentLoggedInUser?.id,
          username: currentLoggedInUser?.username,
          profileImage: currentUserProfile?.data?.profileImage,
        },
        createdAt: new Date().toISOString(),
      };

      const previousPosts = queryClient.getQueryData(["homeFeed"]);

      queryClient.setQueryData(["homeFeed"], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: IPostProps[]) =>
            page.map((p) =>
              p._id === postId
                ? { ...p, comments: [...p.comments, temporaryComment] }
                : p
            )
          ),
        };
      });

      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setShowAllComments(true);

      return { previousPosts };
    },
    onSuccess: (newCommentData, { postId }, context) => {
      // After success, we can use the server's data to ensure consistency.
      // Invalidate the query to fetch the most up-to-date data.
      queryClient.invalidateQueries({ queryKey: ["homeFeed"] });

      // Create notification
      createNotification(
        "commented on your post",
        "COMMENT",
        `/post/${postId}`
      );
    },
    onError: (error, { postId }, context) => {
      toast.error(error.message || "Failed to add comment.");
      if (context?.previousPosts) {
        queryClient.setQueryData(["homeFeed"], context.previousPosts);
      }
    },
  });

  const handleAddComment = (postId: string) => {
    const newCommentText = commentInputs[postId]?.trim();
    if (newCommentText && currentLoggedInUser) {
      addCommentMutation.mutate({ postId, content: newCommentText });
    }
  };

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response: any = await useLikeApi.likePost(postId);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to like/unlike post.");
      }
      return response.message;
    },
    onMutate: async (postId) => {
      const previousPosts = queryClient.getQueryData(["homeFeed"]);
      queryClient.setQueryData(["homeFeed"], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: IPostProps[]) =>
            page.map((p) => {
              if (p._id === postId) {
                const newLikes = isLiked
                  ? p.likes.filter(
                      (like) => like.username !== currentLoggedInUser?.username
                    )
                  : [
                      ...p.likes,
                      {
                        _id: `temp-like-${Date.now()}`,
                        username: currentLoggedInUser?.username || "",
                        owner: currentLoggedInUser?.id || "",
                      },
                    ];
                return { ...p, likes: newLikes };
              }
              return p;
            })
          ),
        };
      });
      setIsLiked((prev) => !prev);
      setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));
      return { previousPosts };
    },
    onSuccess: (message, postId) => {
      if (message === "Post liked successfully") {
        createNotification("liked your post", "LIKE", `/post/${postId}`);
      }
      queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
    },
    onError: (error, postId, context) => {
      toast.error(error.message || "Failed to update like status.");
      queryClient.setQueryData(["homeFeed"], context?.previousPosts);
      setIsLiked((prev) => !prev);
      setLikesCount((prev) => (isLiked ? prev + 1 : prev - 1));
    },
  });

  const handleLike = async () => {
    if (!currentLoggedInUser) {
      toast.error("You must be logged in to like a post.");
      return;
    }
    likeMutation.mutate(post._id);
  };

  const updateCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      const response = await useCommentApi.updateComment(commentId, content);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to update comment.");
      }
      return response.data;
    },
    onSuccess: (updatedCommentData, { commentId }) => {
      queryClient.setQueryData(["homeFeed"], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: IPostProps[]) =>
            page.map((p) =>
              p._id === post._id
                ? {
                    ...p,
                    comments: p.comments.map((comment) =>
                      comment._id === commentId
                        ? {
                            ...comment,
                            content: updatedCommentData.content,
                            edited: true,
                          }
                        : comment
                    ),
                  }
                : p
            )
          ),
        };
      });
      toast.success("Comment updated successfully!");
      createNotification(
        "updated comment on your post",
        "COMMENT",
        `/post/${post._id}`
      );
      setEditingComment(null);
      setEditCommentText("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update comment.");
    },
  });

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
      updateCommentMutation.mutate({ commentId, content: newContent });
    }
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditCommentText("");
  };

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await useCommentApi.deleteComment(commentId);
      if (response.status !== 200) {
        throw new Error(response.message || "Failed to delete comment.");
      }
      return commentId;
    },
    onSuccess: (deletedCommentId) => {
      queryClient.setQueryData(["homeFeed"], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: IPostProps[]) =>
            page.map((p) =>
              p._id === post._id
                ? {
                    ...p,
                    comments: p.comments.filter(
                      (comment) => comment._id !== deletedCommentId
                    ),
                  }
                : p
            )
          ),
        };
      });
      toast.success("Comment deleted successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete comment.");
    },
  });

  const handleDeleteComment = (commentId: string) => {
    deleteCommentMutation.mutate(commentId);
  };

  const isValidId = (id?: string) => id && id.length > 0;

  return (
    <Card
      key={post._id}
      className="border-0 border-b md:border rounded-none md:rounded-lg shadow-none md:shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700"
    >
      <div className="flex items-center justify-between p-3 md:p-4">
        <User post={post} />
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
            <DropdownMenuItem className="dark:text-gray-100 dark:hover:bg-gray-600">
              <Link href={`/post/${post._id}/`} className="w-full">
                See post
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="dark:text-gray-100 dark:hover:bg-gray-600">
              Save
            </DropdownMenuItem>
            {isValidId(session?.user?.id) && isValidId(post.owner?._id) && (
              <ReportModal
                reportedBy={session?.user.id}
                relatedPostId={post._id}
                reportedUser={post?.owner._id}
              >
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="dark:text-gray-100 dark:hover:bg-gray-600"
                >
                  Report
                </DropdownMenuItem>
              </ReportModal>
            )}
            <DropdownMenuItem className="dark:text-red-400 dark:hover:bg-gray-600">
              Unfollow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="ml-6 text-gray-800 dark:text-gray-200">
        {post.caption}
      </div>

      {post.image && post.image.length > 0 && (
        <CardContent className="p-0 relative">
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
          {commentsToDisplay.map((comment, index) => (
            <div
              key={comment._id || `initial-comment-${index}`}
              className="text-sm group text-gray-800 dark:text-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Link
                    href={`person/${
                      comment?.owner?.username ? comment?.owner?._id : "/me"
                    }`}
                    className="font-semibold mr-2 dark:text-gray-100"
                  >
                    {comment?.owner?.username || session?.user?.username}
                  </Link>
                  {editingComment?.commentId === comment._id ? (
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
                      />
                      <div className="flex gap-2 mt-1">
                        <Button
                          onClick={handleSaveEdit}
                          size="sm"
                          className="h-6 px-2 text-xs dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs bg-transparent dark:bg-transparent dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
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
                  !(editingComment?.commentId === comment._id) && (
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
                            onClick={() => handleDeleteComment(comment._id)}
                            className="text-red-600 dark:text-red-400 dark:hover:bg-gray-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                {comment.owner?.username !== currentLoggedInUser?.username &&
                  isValidId(session?.user?.id) &&
                  isValidId(comment.owner?._id) &&
                  !(editingComment?.commentId === comment._id) && (
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
                          <ReportModal
                            reportedBy={session.user.id}
                            reportedUser={comment.owner._id}
                            relatedPostId={post._id}
                            relatedCommentId={comment._id}
                          >
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="dark:text-gray-100 dark:hover:bg-gray-600"
                            >
                              Report
                            </DropdownMenuItem>
                          </ReportModal>
                          <DropdownMenuItem
                            onClick={() => handleDeleteComment(comment._id)}
                            className="text-red-600 dark:text-red-400 dark:hover:bg-gray-600"
                          >
                            Unfollow
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
              </div>
            </div>
          ))}

          {post.comments.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAllComments(!showAllComments);
                setShowComments((prev) => ({
                  ...prev,
                  [post._id]: !showAllComments,
                }));
              }}
              className="text-xs text-gray-500 mt-1 h-auto p-0 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {showAllComments
                ? "Hide comments"
                : `View all ${post.comments.length} comments`}
            </Button>
          )}

          {showComments[post._id] && (
            <div className="mt-3 pt-3 border-t dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <CommentBox
                    postId={post._id}
                    currentLoggedInUser={currentLoggedInUser}
                    commentInputs={commentInputs}
                    handleCommentInputChange={handleCommentInputChange}
                    handleAddComment={handleAddComment}
                    addCommentMutation={addCommentMutation}
                    userImage={userImage}
                    handleFrontendIteractions={() => handleAddComment(post._id)}
                  />
                </div>
              </div>
              {!currentLoggedInUser && (
                <p className="text-xs text-red-500 mt-2 dark:text-red-400">
                  Please log in to add comments.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
