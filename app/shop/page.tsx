import { ShopsPage } from "@/components/shops-page";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { SHOP_ENABLED } from "@/lib/flags";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Shops",
      default: "Shops",
    },
  };
}

export default function Shop() {
  if (!SHOP_ENABLED) redirect("/");
  return (
    <div className="mx-10 md:ml-[250px]">
      <ShopsPage />
    </div>
  );
}
