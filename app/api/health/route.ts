import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  let db = "database unreachable";
  try {
    const client = createAdminClient();
    const { error } = await client.from("profiles").select("id", { count: "exact", head: true });
    if (!error) db = "database hit";
  } catch {
    db = "database unreachable";
  }
  return NextResponse.json({ message: `App running and ${db}`, status: 200 });
}
