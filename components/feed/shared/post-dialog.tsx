import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostApi } from "@/lib/requests";
import React, { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function PostDialog({
  id,
  type,
  children,
  post,
}: {
  id: string;
  type: "EDIT" | "DELETE";
    children: React.ReactNode;
    post?: {
      _caption?: string;
      _location?: string;
  }
  }) {
  const router = useRouter();
  const [caption, setCaption] = useState(post?._caption ?? "");
  const [location, setLocation] = useState(post?._location ?? "");

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission
    // console.log("Updated Post Data:", { postId: id, caption, location });
    try {
      const response = await usePostApi.updatePost({
        postId: id,
        caption,
        location,
      });
      // console.log(response);
      toast.success("Post updated successfully!");
      // Close dialog or show success message
    } catch (error) {
      console.error("Failed to update post:", error);
      toast.error("Failed to update post.");
    }
  };

  const handleDelete = async() => {
    console.log("Delete called for Post ID:", id);
    try {
        const response = await usePostApi.deletePost(id) as any;
      if (response.status === 200) {
        router.push("/person/me");
        toast.success("Post deleted successfully!");
      } else {
        toast.error(response?.message || "Failed to delete post.");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("An error occurred while deleting the post.");
    }
  };

  return (
    <Dialog>
      {type === "DELETE" && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}

      {type === "EDIT" ? (
        <>
          <DialogTrigger asChild>
            {children}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
              <DialogDescription>
                Make changes to your post here. Click save when you&apos;re
                done.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="caption" className="text-right">
                    Caption
                  </Label>
                  <Input
                    id="caption"
                    name="caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="col-span-3"
                    defaultValue={post?._caption ?? caption}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="location" className="text-right">
                    Location
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="col-span-3"
                    defaultValue={post?._location ?? location}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Save changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </>
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete this
              post and its associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
