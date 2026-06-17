"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const formSchema = z.object({
  journeyTitle: z.string().min(2, {
    message: "Title must be at least 2 characters.",
  }),
  journeyLocation: z.string().min(2, {
    message: "Location must be at least 2 characters.",
  }),
});

type JournalFormData = z.infer<typeof formSchema>;

export function CreateJournal() {
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  
  const { content } = useContentStore();

  const form = useForm<JournalFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      journeyTitle: "",
      journeyLocation: "",
    },
  });

  function onSubmit(values: JournalFormData) {
    const fullJournalData = {
      ...values,
      journeyContent: content,
    };
    console.log("Submitting journal data:", fullJournalData);
  }

  const handleSaveDraft = () => {
    const draftData = {
      journeyTitle: form.getValues("journeyTitle"),
      journeyLocation: form.getValues("journeyLocation"),
      journeyContent: content,
    };
    console.log("Saving draft:", draftData);
    setJourneyDialogOpen(false);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            type="button" // Use type="button" to prevent form submission
            variant="outline"
            className="flex-1"
            onClick={handleSaveDraft}
          >
            Save Draft
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600"
          >
            Publish Journey
          </Button>
        </div>
      </form>
    </Form>
  );
}
