"use server";
import { authOptions } from "@/auth";
import { runDBOperation, runDBOperationWithTransaction } from "@/lib/useDB";
import commentsSchema from "@/utils/schema/comments-schema";
import postsSchema from "@/utils/schema/posts-schema";
import profileSchema from "@/utils/schema/profile-schema";
import { getServerSession } from "next-auth";

export async function getComments(postId: string) {
  try {
    const commentsData = await runDBOperation(async () => {
      const comments = await postsSchema
        .findById({ id: postId })
        .populate("comments")
        .exec();
      return comments;
    });
    return {
      message: "Retrieved comments",
      status: 200,
      data: commentsData,
    };
  } catch (err) {
    const errResponse = err as unknown as { message: string; status: number };
    return {
      message: errResponse.message,
      status: errResponse.status,
      data : {}
    };
  }
}

export async function createComment(postBody: any) {
  const userData = await getServerSession(authOptions);
  const userId = userData?.user?.id;
  try {
    // const postBody = await request.json();
    const { content, post } = postBody;
    const owner = userId;
    const newComment = await runDBOperationWithTransaction(async () => {
      const comment = new commentsSchema({ content, owner, post });
      const postUpdate = await postsSchema.findByIdAndUpdate(post, {
        $push: { comments: comment._id },
      });
      const profileUpdate = await profileSchema.findByIdAndUpdate(owner, {
        $push: { comments: comment._id },
      });
      await comment.save();
      return comment;
    });
    return {
      message: "Posted comment",
      status: 200,
      data: newComment,
    };
  } catch (err) {
    console.log(JSON.stringify(err));
    return {
      message: "Error posting comment",
      status: 400,
      data: err,
    };
  }
}

export async function deleteComment(id: string) {
//   const searchParams = request.nextUrl.searchParams;
//   const id = searchParams.get("id");

try {
    const deletedComment = await runDBOperationWithTransaction(async () => {
      const comment = await commentsSchema.findByIdAndDelete(id);
      return comment;
    });
    return Response.json({
      message: "Comment deleted",
      status: 200,
      data: deletedComment,
    });
} catch(err) {
    console.log(JSON.stringify(err));
    return {
      message: "Failed to delete comment",
      status: 500,
      data: {},
    };
}
}

export async function updateComment(postBody: {id: string; content: string}) {
    try {
        const { id, content } = postBody;
        const updatedComment = await runDBOperationWithTransaction(async () => {
            const comment = await commentsSchema.findByIdAndUpdate(
            id,
            { content },
            { new: true }
            );
            return comment;
        });
        return {
            message: "Comment updated",
            status: 200,
            data: updatedComment,
        };
    } catch(err) {
        return {
            message: "Failed to update comment",
            status: 500,
            data: {},
        };
    }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
