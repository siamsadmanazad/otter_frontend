import { z } from "zod";

export const reportSchema = z.object({
  reportedBy: z.string({ required_error: "Reporter ID is required" }),
  reportedUser: z.string({ required_error: "Reported user ID is required" }),
  scope: z.string().trim().min(1, "Scope is required"),
  reason: z.string().trim().min(1, "Reason is required"),
  reasonDescription: z.string().trim().optional(),
  relatedComment: z.string().optional(),
  relatedPost: z.string().optional(),
  status: z
    .enum(["PENDING", "REVIEWED", "RESOLVED"])
    .optional()
    .default("PENDING"),
});

export type ReportInput = z.infer<typeof reportSchema>;
