"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as nsfwjs from "nsfwjs";
import { getSanityMedia } from "@/lib/getSanityImage";
import { XCircle } from 'lucide-react';
import { FormLabel } from "@/components/ui/form";

export async function uploadImage(file: File): Promise<string> {
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

export let nsfwModel: nsfwjs.NSFWJS | null = null;
export const loadNsfwModel = async () => {
  if (!nsfwModel) {
    nsfwModel = await nsfwjs.load();
  }
};

export interface ImageDropzoneProps {
  onFileSelected: (file: File | null) => void;
  label: string;
  value?: File | string | null;
}

export function ImageDropzone({ onFileSelected, label, value }: ImageDropzoneProps) {
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