import { z } from "zod"
import { Dispatch, SetStateAction } from "react"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const idSchema = z.string().refine((val) => UUID_RE.test(val), { message: "Invalid id" })

export const postCreateSchema = z.object({
  image: z.array(z.string().url("Each image must be a valid URL")).optional(),
  likes: z.array(idSchema).optional(),
  caption: z.string().optional(),
  location: z.string().optional(),
  owner: idSchema,
  comments: z.array(idSchema).optional(),
  groupId: z.string().optional(),
})

export type PostCreateInput = z.infer<typeof postCreateSchema>

export interface CreatePostFormProps {
  onSubmit: (data: PostCreateInput) => void;
  owner: string;
  isSubmitting?: boolean;
  submitState: Dispatch<SetStateAction<boolean>>;
}
