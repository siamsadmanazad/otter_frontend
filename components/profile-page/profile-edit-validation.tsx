import { z } from 'zod';

export const socialLinkSchema = z.object({
  platform: z
    .string()
    .min(1, "Platform name cannot be empty.")
    .max(50, "Platform name too long."),
  url: z
    .string()
    .url("Please enter a valid URL")
    .min(1, "URL cannot be empty."),
});

export const bioSchema = z.object({
  bio: z.string().max(300, "Bio must be 300 characters or less").optional(),
});

export const locationSchema = z.object({
  location: z
    .string()
    .max(30, "Location must be 30 characters or less")
    .optional(),
});

export const socialsSchema = z.object({
  socials: z
    .array(socialLinkSchema)
    .min(0)
    .max(5, "Maximum 5 social links allowed"),
});

export const fullNameSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full Name is required.")
    .max(100, "Full Name too long."),
});

export const usernameSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required.")
    .max(50, "Username too long."),
});

export const emailSchema = z.object({
  email: z.string().email("Invalid email address."),
});

export const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long."),
});

export const fullFormSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full Name is required.")
    .max(100, "Full Name too long."),
  username: z
    .string()
    .min(1, "Username is required.")
    .max(50, "Username too long."),
  email: z.string().email("Invalid email address."),
  bio: z
    .string()
    .max(300, "Bio must be 300 characters or less")
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .max(30, "Location must be 30 characters or less")
    .optional()
    .or(z.literal("")),
  socials: z
    .array(socialLinkSchema)
    .min(0)
    .max(5, "Maximum 5 social links allowed")
    .optional(),
});

export type BioFormData = z.infer<typeof bioSchema>;
export type LocationFormData = z.infer<typeof locationSchema>;
export type SocialsFormData = z.infer<typeof socialsSchema>;
export type FullNameFormData = z.infer<typeof fullNameSchema>;
export type UsernameFormData = z.infer<typeof usernameSchema>;
export type EmailFormData = z.infer<typeof emailSchema>;
export type PasswordFormData = z.infer<typeof passwordSchema>;
export type FullFormData = z.infer<typeof fullFormSchema>;
