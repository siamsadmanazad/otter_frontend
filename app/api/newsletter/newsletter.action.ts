"use server";
import { newsLetterValidationSchema } from "@/utils/models/newsletter.model";
import newsletterSchema from "@/utils/schema/newsletter-schema";
import { runDBOperation  } from "@/lib/useDB";

export async function createNewsletter(prevState: any, formData: FormData) {
  try {
    const payload = { email: formData.get("email") as string };
    const data = newsLetterValidationSchema.parse(payload);
    await runDBOperation(async () => {
      const newsLetterDocument = new newsletterSchema(data);
      await newsLetterDocument.save();
    });
    return {
      status: true,
      message: "Newsletter subscription successful",
    };
  } catch (err) {
    console.log(err);
    return {
      status: false,
      message: "Failed to subscribe to newsletter",
    };
  }
}

export async function getNewsletters(page: string, limit: string) {
  try {
    const newsLetters = await newsletterSchema
      .find()
      .limit(parseInt(limit))
      .skip(parseInt(page) * parseInt(limit))
      .lean()
      .exec();
    return {
      status: true,
      message: "Newsletters fetched successfully",
      data: newsLetters,
    };
  } catch (err) {
    return {
      status: false,
      message: "Failed to fetch newsletters",
    };
  }
}
