"use client";
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
import { Label } from "@/components/ui/label";
import { useState, useCallback, useEffect } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { useMediaApi, useUserApi } from "@/lib/requests";
import { Upload, Camera, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { getSanityMedia } from "@/lib/getSanityImage";
import * as nsfwjs from "nsfwjs";
import { toast } from "sonner"; // Assuming sonner is used for toast notifications

type ImageType = "COVER" | "PROFILE";

// Validation schema for image upload
const imageUploadSchema = z.object({
  image: z
    .any()
    .refine((file) => file instanceof File, "Image is required.")
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    )
    .refine(
      (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      "Only JPEG, PNG, and WebP images are allowed"
    ),
});

type ImageFormData = z.infer<typeof imageUploadSchema>;

let nsfwModel: nsfwjs.NSFWJS | null = null;
const loadNsfwModel = async () => {
  if (!nsfwModel) {
    console.log("Loading NSFW model...");
    nsfwModel = await nsfwjs.load("/model.json");
    console.log("NSFW model loaded.");
  }
};

export function ProfileEditImages({
  type,
  children,
}: {
  type: ImageType;
  children: React.ReactNode;
}) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNsfwModelLoading, setIsNsfwModelLoading] = useState(true);

  // Load the NSFW model when the component mounts
  useEffect(() => {
    loadNsfwModel().finally(() => {
      setIsNsfwModelLoading(false);
    });
  }, []);

  const form = useForm<ImageFormData>({
    resolver: zodResolver(imageUploadSchema),
    defaultValues: {
      image: undefined,
    },
  });

  const {
    handleSubmit,
    setValue,
    formState: { errors },
    clearErrors,
    reset,
  } = form;

  const getModalConfig = () => {
    switch (type) {
      case "COVER":
        return {
          title: "Update Cover Image",
          description:
            "Upload a new cover image for your profile. Maximum file size: 5MB.",
          triggerText: "Edit Cover",
          fieldName: "coverImage",
        };
      case "PROFILE":
        return {
          title: "Update Profile Image",
          description: "Upload a new profile picture. Maximum file size: 5MB.",
          triggerText: "Edit Profile Picture",
          fieldName: "profileImage",
        };
      default:
        return {
          title: "Upload Image",
          description: "Upload an image file.",
          triggerText: "Upload Image",
          fieldName: "image",
        };
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      let fileSrc: string | undefined;
      let processedFile = file;
      if (file.type === "image/heic" || file.type === "image/heif") {
        try {
          toast.loading("Converting HEIC image...");
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
      if (file) {
        // const fileSrc = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = fileSrc;
        img.crossOrigin = "anonymous";

        img.onload = async () => {
          if (nsfwModel) {
            const predictions = await nsfwModel.classify(img);
            const isExplicit = predictions.some(
              (p) =>
                (p.className === "Porn" ||
                  p.className === "Sexy" ||
                  p.className === "Hentai") &&
                p.probability > 0.5
            );
            if (isExplicit) {
              toast.error("Explicit image detected, please upload a safe image.");
              URL.revokeObjectURL(fileSrc);
            } else {
              setImageFile(processedFile);
              setValue("image", processedFile, { shouldValidate: true });
              setImagePreview(fileSrc);
              clearErrors("image");
            }
          } else {
            console.warn("NSFW model not loaded, skipping content check.");
            setImageFile(processedFile);
            setValue("image", processedFile, { shouldValidate: true });
            setImagePreview(fileSrc);
            clearErrors("image");
          }
        };

        img.onerror = () => {
          console.error("Error loading image for NSFW check:", file.name);
          toast.error(`Failed to load image: ${file.name}.`);
          URL.revokeObjectURL(fileSrc);
        };
      }
    },
    [setValue, clearErrors]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpeg", ".jpg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
    },
    maxFiles: 1,
    disabled: isNsfwModelLoading,
  });

  const onSubmit = async (data: ImageFormData) => {
    setIsUploading(true);
    try {
      if (!imageFile) {
        throw new Error("No image file selected.");
      }

      // Create a FormData object for the file upload
      const formData = new FormData();
      formData.append("file", imageFile);

      // Perform the fetch call to the media upload API endpoint
      const res = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      // Handle the API response
      if (!res.ok) {
        const dataRes = await res.json();
        throw new Error(dataRes.error || "Failed to upload image.");
      }

      const result = await res.json();
      const mediaLink = await getSanityMedia(result.mediaId);
      const config = getModalConfig();

      // Create the payload to update the user's profile with the new image URL
      const updatePayload = {
        [config.fieldName]: mediaLink.data.url,
      };

      // Call the API to update the user's profile
      await useUserApi.updateUser(updatePayload);

      console.log(`${type} image uploaded successfully:`, result);
      toast.success(`${config.title} updated successfully.`);

      // Reset state and close the dialog
      handleRemoveImage();
      reset();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(error.message || "Failed to upload image. Please try again.");
      if (error instanceof z.ZodError) {
        form.setError("image", {
          type: "manual",
          message: error.errors[0].message,
        });
      } else {
        form.setError("image", {
          type: "manual",
          message: error.message || "Failed to upload image. Please try again.",
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setValue("image", undefined);
    clearErrors("image");
  };

  const handleDialogClose = () => {
    // Revoke the object URL if the dialog is closed without submitting
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setIsDialogOpen(false);
    reset();
  };

  const config = getModalConfig();

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        {children || (
          <Badge variant="outline" className="cursor-pointer">
            {config.triggerText}
          </Badge>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-3">
              <Label htmlFor="image-upload">
                {type === "COVER" ? "Cover Image" : "Profile Image"}
              </Label>

              <div className="flex flex-col gap-3">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isNsfwModelLoading
                      ? "cursor-not-allowed bg-muted"
                      : "cursor-pointer"
                  } ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  } ${imageFile ? "hidden" : ""}`}
                >
                  <input {...getInputProps()} />
                  {isNsfwModelLoading ? (
                    <p className="text-muted-foreground">
                      Loading NSFW model...
                    </p>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      {isDragActive ? (
                        <p className="text-primary">Drop the image here...</p>
                      ) : (
                        <div>
                          <p className="text-lg font-medium mb-2">
                            Drag & drop image here, or click to select
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Supports: JPEG, PNG, WebP, HEIC, HEIF (Max
                            5MB)
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {imagePreview && (
                  <div className="relative">
                    <Image
                      src={imagePreview}
                      alt="Image preview"
                      width={type === "COVER" ? 400 : 200}
                      height={type === "COVER" ? 150 : 200}
                      className={`w-full object-cover rounded-md border ${
                        type === "COVER" ? "h-32" : "h-48"
                      }`}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {errors.image && (
                <span className="text-red-500 text-sm">
                  {errors.image.message}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                onClick={handleDialogClose}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!imageFile || isUploading || isNsfwModelLoading}
            >
              {isUploading ? "Uploading..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
