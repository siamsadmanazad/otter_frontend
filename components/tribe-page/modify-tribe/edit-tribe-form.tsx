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
  TribeCategory,
  TribePrivacy,
} from "@/components/tribes-page/create-tribe/create-tribe.validation";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTribeAPI } from "@/lib/requests";
import { ImageDropzone, uploadImage } from "@/lib/imageUpload.utils";
import { useRouter } from "next/navigation";

const FormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().min(1, "Description is required."),
  category: z.enum(TribeCategory.options),
  privacy: z.enum(TribePrivacy.options),
  tags: z.array(z.string()),
  coverImage: z.union([z.instanceof(File), z.string(), z.null()]).optional(),
  profileImage: z.union([z.instanceof(File), z.string(), z.null()]).optional(),
});

export function EditTribeForm({
  tribeSerial,
  submitTrigger,
  closeButton,
}: {
  tribeSerial: string;
  submitTrigger: (arg0: boolean) => void;
  closeButton: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const queryClient = useQueryClient();

  const {
    data: tribe,
    isLoading: isLoadingTribe,
    isError,
  } = useQuery({
    queryKey: ["tribe", tribeSerial],
    queryFn: async () => {
      const response = await useTribeAPI.getTribeBySerial(tribeSerial);
      console.log("Tribe API response:", response.data);
      return response.data;
    },
    enabled: !!tribeSerial,
  });

  useEffect(() => {
    if (tribe && !isLoadingTribe) {
      const tribeData = Array.isArray(tribe) ? tribe[0] : tribe;

      const category = tribeData.category;
      const privacy = tribeData.privacy;

      form.reset({
        name: tribeData.name || "",
        description: tribeData.description || "",
        category: category as z.infer<typeof TribeCategory>,
        privacy: privacy as z.infer<typeof TribePrivacy>,
        tags: Array.isArray(tribeData.tags) ? tribeData.tags : [],
        coverImage: tribeData.coverImage || null,
        profileImage: tribeData.profileImage || null,
      });
    }
  }, [tribe, isLoadingTribe]);

  const { mutateAsync: updateTribe, isLoading } = useMutation({
    mutationFn: (data: any) => useTribeAPI.updateTribe(tribeSerial, data),
    onSuccess: () => {
      toast.success("Tribe updated!");
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
      queryClient.invalidateQueries({ queryKey: ["tribe", tribeSerial] });
      router.refresh();
    },
    onError: (error) => {
      toast.error(`Failed to update tribe: ${(error as any)?.message}`);
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    try {
      setIsUploadingImages(true);

      const uploadedImageUrls: { coverImage?: string; profileImage?: string } =
        {};

      if (data.coverImage instanceof File) {
        uploadedImageUrls.coverImage = await uploadImage(data.coverImage);
      } else if (typeof data.coverImage === "string" && data.coverImage) {
        uploadedImageUrls.coverImage = data.coverImage;
      }

      if (data.profileImage instanceof File) {
        uploadedImageUrls.profileImage = await uploadImage(data.profileImage);
      } else if (typeof data.profileImage === "string" && data.profileImage) {
        uploadedImageUrls.profileImage = data.profileImage;
      }

      setIsUploadingImages(false);

      const ownerId = (session?.user?.id as string) ?? "";

      const payload = {
        serial: tribeSerial,
        name: data.name,
        description: data.description,
        category: data.category,
        privacy: data.privacy,
        tags: data.tags,
        coverImage: uploadedImageUrls.coverImage || "",
        profileImage: uploadedImageUrls.profileImage || "",
        createdBy: ownerId,
      };

      await updateTribe(payload);
      submitTrigger(false);
    } catch (error) {
      setIsUploadingImages(false);
      console.error("Error updating tribe:", error);
      toast.error("Tribe update failed. Please try again.");
    }
  };

  if (isLoadingTribe) {
    return <div>Loading tribe data...</div>;
  }

  if (isError) {
    return <div>Error loading tribe.</div>;
  }

  return (
    <Form {...form}>
      <h2>Edit tribe details</h2>
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
              <Select onValueChange={field.onChange} value={field.value} defaultValue={tribe.category}>
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
              <Select onValueChange={field.onChange} value={field.value} defaultValue={tribe.privacy}>
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

        <div className="flex flex-row gap-2">
          <Button type="submit" disabled={isLoading || isUploadingImages}>
            {isUploadingImages
              ? "Uploading Images..."
              : isLoading
                ? "Updating Tribe..."
                : "Update Tribe"}
          </Button>
          {closeButton}
        </div>
      </form>
    </Form>
  );
}
