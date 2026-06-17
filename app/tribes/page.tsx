import { Metadata } from "next";
import TribesPage_V101 from "@/components/tribes-page/tribes-page_v1.01";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Tribes",
      default: "Tribes",
    },
    description: "Tribes of TripOtter",
  };
}

export default function Tribes() {
  return (
    <div className="md:ml-[250px]">
      <TribesPage_V101 />
    </div>
  );
}
