"use server";
import { newsLetterValidationSchema } from "@/utils/models/newsletter.model";
import { createAdminClient } from "@/lib/supabase/admin";

// Server action used by the newsletter form (useActionState).
export async function createNewsletter(_prevState: unknown, formData: FormData) {
  try {
    const payload = { email: formData.get("email") as string };
    const data = newsLetterValidationSchema.parse(payload);
    const db = createAdminClient();
    const { error } = await db.from("newsletter").insert({ email: data.email });
    if (error) {
      // unique violation = already subscribed; treat as success to avoid email enumeration
      if (error.code === "23505") {
        return { status: true, message: "You're already subscribed" };
      }
      throw error;
    }
    return { status: true, message: "Newsletter subscription successful" };
  } catch (err) {
    console.error("createNewsletter error:", err);
    return { status: false, message: "Failed to subscribe to newsletter" };
  }
}

export async function getNewsletters(page: string, limit: string) {
  try {
    const db = createAdminClient();
    const p = parseInt(page, 10) || 0;
    const l = parseInt(limit, 10) || 10;
    const { data, error } = await db
      .from("newsletter")
      .select("*")
      .order("subscribed_at", { ascending: false })
      .range(p * l, p * l + l - 1);
    if (error) throw error;
    return { status: true, message: "Newsletters fetched successfully", data };
  } catch {
    return { status: false, message: "Failed to fetch newsletters" };
  }
}
