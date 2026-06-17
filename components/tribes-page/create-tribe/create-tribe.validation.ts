import { z } from "zod";

export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const TribeCategory = z.enum([
  "JOURNEY",
  "LOCATION",
  "COMMUNITY",
  "FOOD",
  "BIKERS",
  "CYCLISTS",
  "LONG_TRAVEL",
  "ABROAD",
]);

export const TribePrivacy = z.enum(["PUBLIC", "PRIVATE"]);

export const TribeBaseFields = {
  description: z.string().max(4096, "Description must be less than 4096 characters"),
  category: TribeCategory.default("COMMUNITY"),
  tags: z.array(z.string()).optional(),
  coverImage: z.string().url("coverImage must be a valid URL").optional(),
  profileImage: z.string().url("profileImage must be a valid URL").optional(),
  name: z
    .string()
    .min(2, "Tribe name must be at least 2 characters")
    .max(50, "Tribe name must be less than 50 characters"),
  createdBy: objectId.optional(),
  privacy: TribePrivacy.default("PUBLIC"),
};

export const TribeDocumentSchema = z.object({
  ...TribeBaseFields,
});

export const TribeCreateSchema = z.object({
  ...TribeBaseFields,
});

export const TribeUpdateSchema = z
  .object({
    ...TribeBaseFields,
  })
  .partial();

export type TribeDocumentZ = z.infer<typeof TribeDocumentSchema>;
export type TribeCreateInput = z.infer<typeof TribeCreateSchema>;
export type TribeUpdateInput = z.infer<typeof TribeUpdateSchema>;
