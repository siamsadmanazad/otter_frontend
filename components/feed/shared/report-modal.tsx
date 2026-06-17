"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useReportApi } from "@/lib/requests";

export const reportSchema = z.object({
  reportedBy: z
    .string({ required_error: "Reporter ID is required" })
    .min(1, "Reporter ID cannot be empty"),
  reportedUser: z
    .string({ required_error: "Reported user ID is required" })
    .min(1, "Reported user ID cannot be empty"),
  scope: z.enum(
    ["Post", "Comment", "Profile", "Message", "Story", "Live Stream", "Other"],
    {
      required_error: "Scope is required",
      invalid_type_error: "Please select a valid scope",
    }
  ),
  reason: z.string().trim().min(1, "Reason is required"),
  reasonDescription: z.string().trim().optional(),
  relatedComment: z.string().trim().optional(),
  relatedPost: z.string().trim().optional(),
  status: z
    .enum(["PENDING", "REVIEWED", "RESOLVED"])
    .optional()
    .default("PENDING"),
});

export type ReportInput = z.infer<typeof reportSchema>;

type TReportModalProps = {
  reportedBy: string;
  reportedUser: string;
  relatedPostId?: string;
  relatedCommentId?: string;
  children: React.ReactNode;
};

export function ReportModal({
  reportedBy,
  reportedUser,
  relatedPostId,
  relatedCommentId,
  children
}: TReportModalProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset, // Function to reset the form
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportedBy,
      reportedUser,
      scope: "Post",
      reason: "",
      reasonDescription: "",
      relatedComment: relatedCommentId || "", // Ensure default is empty string if undefined
      relatedPost: relatedPostId || "", // Ensure default is empty string if undefined
    },
  });

  // Function to handle form submission
  const onSubmit = async (data: ReportInput) => {
    try {
      await useReportApi.createReport(data);
      reset(); // Reset form fields after successful submission
      setIsOpen(false); // Close the dialog
      toast.info("Report created");
    } catch (err) {
      console.error("Error submitting report:", err);
      toast.error("Error submitting report");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Submit a Report</DialogTitle>
          <DialogDescription>
            Please provide details about the content or user you are reporting.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          {/* Hidden fields for auto-injected values */}
          <input type="hidden" {...register("reportedBy")} />
          <input type="hidden" {...register("reportedUser")} />
          <input type="hidden" {...register("relatedComment")} />
          <input type="hidden" {...register("relatedPost")} />

          {/* Scope - Changed to a dropdown */}
          <div className="grid gap-3">
            <Label htmlFor="scope">Scope of Report</Label>
            <select
              id="scope"
              {...register("scope")}
              className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                errors.scope ? "border-red-500" : ""
              }`}
            >
              <option value="">Select a scope</option>{" "}
              {/* Added a default empty option */}
              <option value="Post">Post</option>
              <option value="Comment">Comment</option>
              <option value="Profile">Profile</option>
              <option value="Message">Message</option>
              <option value="Story">Story</option>
              <option value="Live Stream">Live Stream</option>
              <option value="Other">Other</option>
            </select>
            {errors.scope && (
              <p className="text-red-500 text-sm mt-1">
                {errors.scope.message}
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="grid gap-3">
            <Label htmlFor="reason">Reason for Report</Label>
            <Input
              id="reason"
              {...register("reason")}
              placeholder="e.g., Harassment, Spam, Misinformation"
              className={errors.reason ? "border-red-500" : ""}
            />
            {errors.reason && (
              <p className="text-red-500 text-sm mt-1">
                {errors.reason.message}
              </p>
            )}
          </div>

          {/* Reason Description (Textarea) */}
          <div className="grid gap-3">
            <Label htmlFor="reasonDescription">Description (Optional)</Label>
            <Textarea
              id="reasonDescription"
              {...register("reasonDescription")}
              placeholder="Provide more details about the report..."
              rows={4}
              className={errors.reasonDescription ? "border-red-500" : ""}
            />
            {errors.reasonDescription && (
              <p className="text-red-500 text-sm mt-1">
                {errors.reasonDescription.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
