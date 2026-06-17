import { defineField, defineType } from "sanity";
import { FileVideo } from "lucide-react";

export const videoType = defineType({
  name: "videos",
  title: "Videos",
  type: "document",
  icon: FileVideo,
  fields: [
    defineField({
      name: "video",
      title: "Video",
      type: "file",
      options: {
        accept: "video/*",
      },
      validation: (Rule) => Rule.required().error("A video file is required."),
      fields: [
        defineField({
          name: "alt",
          title: "Alternative Text",
          type: "string",
          description: "Important for accessibility and SEO.",
          validation: (Rule) =>
            Rule.required()
              .min(5)
              .error("Alt text must be at least 5 characters long."),
        }),
      ],
    }),
  ],
});
