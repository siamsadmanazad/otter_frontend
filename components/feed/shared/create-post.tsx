"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { X, Upload, ImageIcon, MapPin, Type } from "lucide-react";
import Image from "next/image";
import * as nsfwjs from "nsfwjs";

import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "sonner";
import {
  postCreateSchema,
  type PostCreateInput,
  type CreatePostFormProps,
} from "@/utils/models/post.model";
import { useSession } from "next-auth/react";
import { DialogTitle } from "@radix-ui/react-dialog";
import { usePostApi } from "@/lib/requests";
import { getSanityMedia } from "@/lib/getSanityImage";

import { useMutation, useQueryClient } from "@tanstack/react-query";

let nsfwModel: nsfwjs.NSFWJS | null = null;
const loadNsfwModel = async () => {
  if (!nsfwModel) {
    nsfwModel = await nsfwjs.load();
  }
};

interface ISubmitProps {
  form: any;
  files: File[];
  isSubmitting: boolean;
}

function SubmitButton({ form, files, isSubmitting }: ISubmitProps) {
  const caption = useWatch({
    control: form.control,
    name: "caption",
  });

  const isFormInvalid = !caption?.trim() && files.length === 0;

  return (
    <Button
      type="submit"
      disabled={isSubmitting || isFormInvalid}
      className="min-w-[120px]"
    >
      {isSubmitting ? "Creating..." : "Create Post"}
    </Button>
  );
}

export function CreatePost({
  children,
  profileId,
  groupId,
}: {
  children?: React.ReactNode;
  profileId: string;
  groupId?: string;
}) {
  const searchParams = useSearchParams();
  const formParam = searchParams.get("form");

  const shouldAutoOpen = formParam === "create";

  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const createPostMutation = useMutation({
    mutationFn: async (data: PostCreateInput) => {
      return groupId
        ? usePostApi.createPost({ ...data, fromGroup: groupId })
        : usePostApi.createPost(data);
    },
    onSuccess: () => {
      setIsOpen(false);
      toast.success("Post created successfully!");
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
      queryClient.invalidateQueries({ queryKey: ["HomeFeed"] });
    },
    onError: (error) => {
      console.error("Failed to create post:", error);
      toast.error(
        `Failed to create post: ${(error as any).message || "Unknown error"}`
      );
    },
  });

  return (
    <Dialog defaultOpen={shouldAutoOpen} open={isOpen} onOpenChange={setIsOpen}>
      <form>
        <DialogTrigger asChild>
          {children ? children : <Button>Create Post</Button>}
        </DialogTrigger>
        <DialogContent className="p-4 sm:p-6 w-[95vw] max-h-[90vh] sm:w-auto sm:h-auto sm:max-w-[625px] overflow-y-auto">
          <DialogTitle></DialogTitle>
          <CreatePostForm
            onSubmit={createPostMutation.mutateAsync}
            owner={profileId}
            isSubmitting={createPostMutation.isLoading}
          />
        </DialogContent>
      </form>
    </Dialog>
  );
}

export function CreatePostForm({
  onSubmit,
  owner,
  isSubmitting,
}: Omit<CreatePostFormProps, "submitState"> & {
  onSubmit: (data: PostCreateInput) => Promise<any>;
  isSubmitting: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const { data: session } = useSession();
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    loadNsfwModel();
  }, []);

  const form = useForm<PostCreateInput>({
    resolver: zodResolver(postCreateSchema),
    defaultValues: {
      caption: "",
      location: "",
      owner,
      image: [],
      likes: [],
      comments: [],
    },
  });

  const locationValue = form.watch("location");

  // Debounce the search to avoid too many API calls
  useEffect(() => {
    // Only run the effect if there's a location value
    if (!locationValue || locationValue.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${locationValue}`,
          {
            headers: {
              "User-Agent": "My Social App / 1.0",
            },
          }
        );
        if (!res.ok) throw new Error("Failed to fetch locations");
        const data = await res.json();
        setSuggestions(data);
      } catch (error) {
        console.error("Nominatim API error:", error);
        toast.error("Failed to search for locations. Please try again.");
      }
    }, 500); // 500ms debounce time

    // Cleanup function to clear the timeout
    return () => clearTimeout(timeoutId);
  }, [locationValue]);
  const [_isSubmitting, setIsSubmitting] = useState(false);
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const filteredFiles: File[] = [];
      const imagePromises = acceptedFiles.map(async (file) => {
        if (!file.type.startsWith("image/")) {
          filteredFiles.push(file);
          return;
        }

        let processedFile = file;
        let fileSrc: string | undefined;

        if (file.type === "image/heic" || file.type === "image/heif") {
          try {
            const heic2anyModule = await import("heic2any");
            const heic2any = heic2anyModule.default;

            const convertedBlob = await heic2any({
              blob: file,
              toType: "image/jpeg",
              quality: 0.8,
            });
            processedFile = new File(
              [convertedBlob as Blob],
              file.name.replace(/\.heic$/i, ".jpeg"),
              { type: "image/jpeg" }
            );
            fileSrc = URL.createObjectURL(processedFile);
          } catch (error) {
            console.error("Error converting HEIC file:", error);
            toast.error(
              `Failed to process HEIC image: ${file.name}. Please try a different format.`
            );
            return;
          }
        } else {
          fileSrc = URL.createObjectURL(file);
        }

        if (!fileSrc) {
          console.error("File source could not be created for", file.name);
          return;
        }

        const img = document.createElement("img");
        img.src = fileSrc;

        return new Promise<void>((resolve) => {
          img.onload = async () => {
            if (nsfwModel) {
              const predictions = await nsfwModel.classify(img);
              // Check if any of 'Porn', 'Sexy', or 'Hentai' classes have a probability above 50%
              const isExplicit = predictions.some(
                (p) =>
                  (p.className === "Porn" ||
                    p.className === "Sexy" ||
                    p.className === "Hentai") &&
                  p.probability > 0.5
              );

              if (isExplicit) {
                toast.error(
                  "Explicit image detected, please keep the platform safe for everyone."
                );
              } else {
                filteredFiles.push(processedFile); // Push the processed file (original or converted)
              }
            } else {
              // If NSFW model not loaded, still add the file
              filteredFiles.push(processedFile);
            }
            URL.revokeObjectURL(fileSrc); // Clean up the object URL after use
            resolve();
          };
          img.onerror = () => {
            console.error("Error loading image for NSFW check:", file.name);
            toast.error(
              `Failed to load image for content check: ${file.name}.`
            );
            URL.revokeObjectURL(fileSrc); // Clean up the object URL
            resolve(); // Resolve the promise to not block other files
          };
        });
      });

      await Promise.all(imagePromises);

      const newFiles = filteredFiles.slice(0, 10 - files.length);
      setFiles((prev) => [...prev, ...newFiles]);
    },
    [files.length]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".heic", ".heif"], // Added .heif for completeness
      "video/*": [".mp4", ".mov", ".avi", ".mkv"],
    },
    maxFiles: 10,
    disabled: files.length >= 10,
  });

  const handleSubmit = async (data: PostCreateInput) => {
    // isSubmitting is now handled by useMutation's isLoading
    setIsSubmitting(true);
    if (files.length === 0 && !data.caption?.trim()) {
      toast.error("Please add a caption or at least one image");
      return;
    }
    try {
      const uploadedImageIds: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const dataRes = await res.json();
          throw new Error(dataRes.error || "Failed to upload image");
        }

        const result = await res.json();
        const mediaLink = await getSanityMedia(result.mediaId);
        uploadedImageIds.push(mediaLink.data.url);
      }

      const ownerId = (session?.user?.id as string) ?? "";
      // Call the mutateAsync function passed from the parent component
      await onSubmit({
        ...data,
        image: uploadedImageIds,
        owner: ownerId,
      });

      setFiles([]);
      form.reset();
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error submitting post:", error);
      toast.error("Failed to create post");
      setIsSubmitting(false);
      // Error toast is now handled by the onError callback in the parent CreatePost component
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-1">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Create New Post</h2>
          <p className="text-muted-foreground">
            Share your moment with the world
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Image Upload Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                <h3 className="text-lg font-medium">Images</h3>
                <span className="text-sm text-muted-foreground">
                  ({files.length}/10)
                </span>
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                } ${files.length >= 10 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-primary">Drop the images here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">
                      {files.length >= 10
                        ? "Maximum 10 images allowed"
                        : "Drag & drop images here, or click to select"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports: JPEG, PNG, GIF, WebP, Heic (Max 10 images)
                    </p>
                  </div>
                )}
              </div>

              {/* Image Previews */}
              {files.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {files.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <Image
                          src={URL.createObjectURL(file)} // This will now use the converted JPEG blob for HEIC files
                          alt={`Preview ${index + 1}`}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Caption Field */}
            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Caption <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write a caption for your post..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Share what's on your mind or describe your post
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Field - Now with OpenStreetMap Nominatim */}
            <div className="relative">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Search for a location..."
                        {...field}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormDescription>
                      Start typing to search for a location
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Dropdown for suggestions */}
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.place_id}
                      className="p-2 cursor-pointer hover:bg-muted"
                      onClick={() => {
                        // Set the form value and clear suggestions
                        form.setValue("location", suggestion.display_name, {
                          shouldValidate: true,
                        });
                        setSuggestions([]);
                      }}
                    >
                      {suggestion.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setSuggestions([]); // Also clear suggestions on reset
                }}
                disabled={isSubmitting}
              >
                Clear
              </Button>
              {/* Use the new SubmitButton component to encapsulate the re-render logic */}
              <SubmitButton
                form={form}
                files={files}
                isSubmitting={_isSubmitting}
              />
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
