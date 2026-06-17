import { z } from "zod"
import mongoose from "mongoose"
import { Dispatch, SetStateAction } from "react"

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId",
})

export const postCreateSchema = z.object({
  image: z.array(z.string().url("Each image must be a valid URL")).optional(),
  likes: z.array(objectIdSchema).optional(),
  caption: z.string().optional(),
  location: z.string().optional(),
  owner: objectIdSchema.refine((val) => mongoose.Types.ObjectId.isValid(val), "Owner must be a valid ObjectId"),
  comments: z.array(objectIdSchema).optional(),
  groupId: z.string().optional(),
})

export type PostCreateInput = z.infer<typeof postCreateSchema>

export interface CreatePostFormProps {
  onSubmit: (data: PostCreateInput) => void;
  owner: string;
  isSubmitting?: boolean;
  submitState: Dispatch<SetStateAction<boolean>>;
}
