import { z } from "zod";

export const newsLetterValidationSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  location: z.string().optional(),
});

export type TNewsLetterValidationSchema = z.infer<
  typeof newsLetterValidationSchema
>;
