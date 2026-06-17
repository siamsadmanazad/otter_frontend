import { ShopsPage } from "@/components/shops-page";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Shops",
      default: "Shops",
    },
  };
}

export default function Shop() {
  return (
    <div className="mx-10 md:ml-[250px]">
      <ShopsPage />
    </div>
  );
}
