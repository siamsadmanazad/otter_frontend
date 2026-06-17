import { Metadata } from "next";
import { ResetPasswordPage } from "./_component";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Verify",
      default: "Verify",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResetPasswordPage id={id} />;
}
