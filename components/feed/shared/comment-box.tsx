"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  SendHorizonal,
  Loader,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ICommentBoxProps {
  postId: string;
  currentLoggedInUser: any;
  commentInputs: { [key: string]: string };
  handleCommentInputChange: (postId: string, value: string) => void;
  handleAddComment: (postId: string) => void;
  addCommentMutation: any;
  userImage: string;
  handleFrontendIteractions?: (postId: string) => void;
}

export const CommentBox = ({
  postId,
  currentLoggedInUser,
  commentInputs,
  handleCommentInputChange,
  handleAddComment,
  addCommentMutation,
  userImage,
}: ICommentBoxProps) => {
  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t dark:border-gray-700">
      <Avatar className="w-6 h-6">
        <AvatarImage src={userImage ?? "/placeholder.svg?height=24&width=24"} />
        <AvatarFallback className="dark:bg-gray-700 dark:text-gray-300">
          {currentLoggedInUser?.name?.[0]?.toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 relative">
        <Textarea
          placeholder="Add a comment..."
          value={commentInputs[postId] || ""}
          onChange={(e) => handleCommentInputChange(postId, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAddComment(postId);
            }
          }}
          className="pr-12 text-sm resize-none overflow-hidden h-auto max-h-40" // added max-h-40 to prevent excessive height
          disabled={!currentLoggedInUser || addCommentMutation.isPending}
        />
        {commentInputs[postId]?.trim() && currentLoggedInUser && (
          <Button
            onClick={() => handleAddComment(postId)}
            size="sm"
            disabled={addCommentMutation.isPending}
            className="absolute right-2 bottom-2 h-8 w-8 p-0 flex items-center justify-center rounded-full transition duration-300 ease-in-out disabled:opacity-50"
          >
            {addCommentMutation.isPending ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};