"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useContentStore } from "@/components/richtext-editor/state-hooks/content-store";
import Dynamic from "next/dynamic";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePostApi } from "@/lib/requests";
import { LoadingSmall } from "../../ui/loading";

const SimpleEditor = Dynamic(
  () =>
    import("@/components/richtext-editor/tiptap-templates/simple/simple-editor").then(
      (mod) => mod.SimpleEditor
    ),
  {
    ssr: true,
    loading: () => (
      <Button className="bg-white dark:bg-black">
        <LoadingSmall />
      </Button>
    ),
  }
);

const DRAFT_KEY = "tripotter:journal-draft";

const formSchema = z.object({
  journeyTitle: z.string().min(2, {
    message: "Title must be at least 2 characters.",
  }),
  journeyLocation: z.string().min(2, {
    message: "Location must be at least 2 characters.",
  }),
});

type JournalFormData = z.infer<typeof formSchema>;

// Tiptap stores its content as an HTML string. The posts.caption column renders
// as plain text everywhere, so flatten the rich content to readable text while
// preserving paragraph/line breaks. (Full rich-HTML fidelity is a fast-follow —
// it needs a dedicated content column + a sanitized renderer. See gap G3 note.)
function htmlToText(html: string): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text =
    typeof window !== "undefined"
      ? new DOMParser().parseFromString(withBreaks, "text/html").body
          .textContent || ""
      : withBreaks.replace(/<[^>]+>/g, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function CreateJournal({
  children,
  profileId,
  groupId,
}: {
  children?: React.ReactNode;
  profileId?: string;
  groupId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { content, updateContent } = useContentStore();
  const queryClient = useQueryClient();

  const form = useForm<JournalFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      journeyTitle: "",
      journeyLocation: "",
    },
  });

  // Restore a saved draft when the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.journeyTitle) form.setValue("journeyTitle", draft.journeyTitle);
      if (draft.journeyLocation)
        form.setValue("journeyLocation", draft.journeyLocation);
      if (draft.journeyContent) updateContent(draft.journeyContent);
    } catch {
      /* ignore malformed drafts */
    }
  }, [isOpen, form, updateContent]);

  const publishMutation = useMutation({
    mutationFn: async (values: JournalFormData) => {
      const body = htmlToText(content);
      if (!body) {
        throw new Error("Please write your journey story before publishing.");
      }
      const caption = `${values.journeyTitle.trim()}\n\n${body}`;
      return usePostApi.createPost({
        caption,
        location: values.journeyLocation.trim(),
        postType: "JOURNAL",
        image: [],
        ...(groupId ? { fromGroup: groupId } : {}),
      });
    },
    onSuccess: () => {
      toast.success("Journey published!");
      localStorage.removeItem(DRAFT_KEY);
      form.reset();
      updateContent("");
      queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
      queryClient.invalidateQueries({ queryKey: ["ProfileFeed"] });
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile", profileId] });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(
        (error as Error)?.message || "Failed to publish journey. Please try again."
      );
    },
  });

  const handleSaveDraft = () => {
    const draft = {
      journeyTitle: form.getValues("journeyTitle"),
      journeyLocation: form.getValues("journeyLocation"),
      journeyContent: content,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    toast.success("Draft saved.");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children ? children : <Button>Create Journey</Button>}
      </DialogTrigger>
      <DialogContent className="p-4 sm:p-6 w-[95vw] max-h-[90vh] sm:w-auto sm:h-auto sm:max-w-[680px] overflow-y-auto">
        <DialogTitle className="sr-only">Create a Journey</DialogTitle>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => publishMutation.mutate(values))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="journeyTitle"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Journey Title</FormLabel>
                  <FormControl>
                    <Input
                      id="journey-title"
                      placeholder="My Adventure in..."
                      className="text-lg font-semibold"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="journeyLocation"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="journey-location"
                        placeholder="Where did this journey take place?"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2 max-w-[600px]">
              <Label htmlFor="journey-content">Your Story</Label>
              <SimpleEditor />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSaveDraft}
                disabled={publishMutation.isPending}
              >
                Save Draft
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600"
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? "Publishing..." : "Publish Journey"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
