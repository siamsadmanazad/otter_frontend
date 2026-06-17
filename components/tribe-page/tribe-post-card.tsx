"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Share,
  MoreHorizontal,
  Heart,
  MapPin,
} from "lucide-react";
import { useCommentApi, useLikeApi } from "@/lib/requests";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { IPostProps } from "@/types/post";
import { toast } from "sonner";
import { Socket } from "socket.io-client";

dayjs.extend(relativeTime);

export function TribePostCard({
    post,
    currentUserProfile,
    session,
    userImage,
    socket,
    isSocketConnected
}: 
  {
    post: IPostProps,
    currentUserProfile: any;
    session: {
      user: {
        id: string;
        name: string;
        email: string;
        image?: string;
        username: string;
      };
    } | null;
    userImage: any
    socket: Socket<any, any>;
    isSocketConnected: boolean;
  }) {
    const currentLoggedInUser = session?.user;
    const queryClient = useQueryClient();
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
        await queryClient.cancelQueries({ queryKey: ["tribeFeed"] });
  
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
  
        const previousPosts = queryClient.getQueryData(["tribeFeed"]);
  
        queryClient.setQueryData(["tribeFeed"], (oldData: any) => {
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
        queryClient.invalidateQueries({ queryKey: ["tribeFeed"] });
  
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
          queryClient.setQueryData(["tribeFeed"], context.previousPosts);
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
        const previousPosts = queryClient.getQueryData(["tribeFeed"]);
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
              <Card key={post._id} className="dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-0">
              <div className="p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={post.owner?.profileImage || "/placeholder.svg"}
                        alt={post.owner?.fullName}
                      />
                      <AvatarFallback>{post.owner?.fullName}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold dark:text-white">
                          {post.owner?.fullName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          User
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>@{post.owner?.username}</span>
                        <span>•</span>
                        <span>{dayjs(post.createdAt).fromNow()}</span>
                        {post.location && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {post.location}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="dark:hover:bg-gray-800"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {post.caption}
                </p>
              </div>

              {post.image && post.image.length > 0 && (
                <div className="relative aspect-video">
                  <img
                    src={post.image[0] || "/placeholder.svg"}
                    alt="Post image"
                    className="object-cover w-full h-full"
                  />
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                    >
                      <Heart className="w-4 h-4" />
                      {post.likes.length ?? 0}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {post.comments.length ?? 0}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                    >
                      <Share className="w-4 h-4" />0
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
  );
}