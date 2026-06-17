"use client";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  TribeCreateSchema,
  TribeCreateInput,
  TribeCategory,
  TribePrivacy,
} from "./create-tribe.validation";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as nsfwjs from "nsfwjs";
import { useSession } from "next-auth/react";
import { getSanityMedia } from "@/lib/getSanityImage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTribeAPI } from "@/lib/requests";
import { XCircle } from 'lucide-react';

async function uploadImage(file: File): Promise<string> {
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
  return mediaLink.data.url;
}

let nsfwModel: nsfwjs.NSFWJS | null = null;
const loadNsfwModel = async () => {
  if (!nsfwModel) {
    nsfwModel = await nsfwjs.load();
  }
};

interface ImageDropzoneProps {
  onFileSelected: (file: File | null) => void;
  label: string;
  value?: File | string | null;
}

function ImageDropzone({ onFileSelected, label, value }: ImageDropzoneProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadNsfwModel();
  }, []);

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof value === 'string' && value) {
      setPreviewUrl(value);
      return;
    } else {
      setPreviewUrl(null);
    }
  }, [value]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file || !file.type.startsWith("image/")) {
        toast.error("Please drop an image file.");
        return;
      }

      let processedFile = file;
      let fileSrc: string | undefined;

      if (file.type === "image/heic" || file.type === "image/heif") {
        try {
          const heic2anyModule = await import("heic2any");
          const heic2any = heic2anyModule.default;
          const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
          processedFile = new File([convertedBlob as Blob], file.name.replace(/\.heic$/i, ".jpeg"), { type: "image/jpeg" });
          fileSrc = URL.createObjectURL(processedFile);
        } catch {
          toast.error(`Failed to process HEIC image: ${file.name}`);
          return;
        }
      } else {
        fileSrc = URL.createObjectURL(file);
      }

      if (!fileSrc) return;

      const img = document.createElement("img");
      img.src = fileSrc;

      const imageLoadPromise = new Promise<void>((resolve, reject) => {
        img.onload = async () => {
          if (nsfwModel) {
            const predictions = await nsfwModel.classify(img);
            const isExplicit = predictions.some(
              (p) =>
                (p.className === "Porn" || p.className === "Sexy" || p.className === "Hentai") &&
                p.probability > 0.5
            );

            if (isExplicit) {
              toast.error("Explicit image detected.");
              reject(new Error("Explicit image detected."));
            } else {
              onFileSelected(processedFile);
              resolve();
            }
          } else {
            onFileSelected(processedFile);
            resolve();
          }
          URL.revokeObjectURL(fileSrc);
        };
        img.onerror = () => {
          toast.error(`Failed to load image: ${file.name}`);
          URL.revokeObjectURL(fileSrc);
          reject(new Error("Failed to load image."));
        };
      });

      try {
        await imageLoadPromise;
      } catch (err) {
        console.error(err);
      }
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".heic", ".heif"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelected(null);
  };

  return (
    <div className="space-y-2">
      <FormLabel>{label}</FormLabel>
      <div
        {...getRootProps()}
        className={cn(
          "relative border border-dashed rounded-md px-4 py-10 text-center cursor-pointer transition",
          isDragActive ? "bg-muted/50" : "bg-muted"
        )}
      >
        <input {...getInputProps()} />
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto object-cover rounded-md" />
            <button
                onClick={handleCancel}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 bg-white rounded-full shadow-md"
            >
                <XCircle size={16} />
            </button>
          </>
        ) : (
          <p>Drag & drop or click to upload</p>
        )}
      </div>
    </div>
  );
}

// Define a separate Zod schema for the form's local state to handle the File objects
const FormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().min(1, "Description is required."),
  category: z.enum(TribeCategory.options),
  privacy: z.enum(TribePrivacy.options),
  tags: z.array(z.string()),
  coverImage: z.union([z.instanceof(File), z.string(), z.null()]).optional(),
  profileImage: z.union([z.instanceof(File), z.string(), z.null()]).optional(),
});

export function CreateTribeForm({
  submitTrigger,
  closeButton,
}: {
  submitTrigger: (arg0: boolean)=>void;
  closeButton: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema), // Use the new local schema for validation
    defaultValues: {
      name: "",
      description: "",
      category: "COMMUNITY",
      privacy: "PUBLIC",
      tags: [],
      coverImage: "",
      profileImage: "",
    },
  });

  const queryClient = useQueryClient();

  const { mutateAsync: createTribe, isLoading } = useMutation({
    mutationFn: (data: any) => useTribeAPI.createTribe(data),
    onSuccess: () => {
      toast.success("Tribe created!");
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
      queryClient.invalidateQueries({ queryKey: ["HomeFeed"] });
      queryClient.invalidateQueries({ queryKey: ["tribes"] });
    },
    onError: (error) => {
      toast.error(`Failed to create tribe: ${(error as any)?.message}`);
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    try {
      setIsUploadingImages(true);

      const uploadedImageUrls: { coverImage?: string; profileImage?: string } = {};

      if (data.coverImage instanceof File) {
        uploadedImageUrls.coverImage = await uploadImage(data.coverImage);
      } else if (typeof data.coverImage === 'string' && data.coverImage) {
        uploadedImageUrls.coverImage = data.coverImage;
      }

      if (data.profileImage instanceof File) {
        uploadedImageUrls.profileImage = await uploadImage(data.profileImage);
      } else if (typeof data.profileImage === 'string' && data.profileImage) {
        uploadedImageUrls.profileImage = data.profileImage;
      }

      setIsUploadingImages(false);

      const ownerId = (session?.user?.id as string) ?? "";

      // Construct a new payload to match the original API schema
      const payload: TribeCreateInput = {
        name: data.name,
        description: data.description,
        category: data.category,
        privacy: data.privacy,
        tags: data.tags,
        coverImage: uploadedImageUrls.coverImage || "",
        profileImage: uploadedImageUrls.profileImage || "",
      };

      await createTribe({
        ...payload,
        createdBy: ownerId,
      });

      submitTrigger(false);
    } catch (error) {
      setIsUploadingImages(false);
      console.error("Error creating tribe:", error);
      toast.error("Tribe creation failed. Please try again.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tribe Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter tribe name" {...field} />
              </FormControl>
              <FormMessage />
              <FormDescription>Your tribe name</FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter tribe description" {...field} />
              </FormControl>
              <FormMessage />
              <FormDescription>What is your tribe about?</FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TribeCategory.options.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Your tribe category</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="privacy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Privacy</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select privacy" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TribePrivacy.options.map((privacy) => (
                    <SelectItem key={privacy} value={privacy}>
                      {privacy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Public or private</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags (comma-separated)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. travel, adventure"
                  value={field.value?.join(", ") || ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </FormControl>
              <FormDescription>Keywords for your tribe</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="coverImage"
          render={({ field }) => (
            <FormItem>
              <ImageDropzone
                label="Cover Image"
                onFileSelected={field.onChange}
                value={field.value}
              />
              <FormDescription>This will be public</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="profileImage"
          render={({ field }) => (
            <FormItem>
              <ImageDropzone
                label="Profile Image"
                onFileSelected={field.onChange}
                value={field.value}
              />
              <FormDescription>This will be public</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading || isUploadingImages}>
          {isUploadingImages ? "Uploading Images..." : (isLoading ? "Creating Tribe..." : "Create Tribe")}
        </Button>
        {closeButton}
      </form>
    </Form>
  );
}
