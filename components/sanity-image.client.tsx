"use client";
// removed next/image usage to block auto image optimization
// auto image optimization is blocked anyway in the next.config.js
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { getSanityImage } from "@/lib/getSanityImage";

export default function SanityImage({
  image,
  alt,
  className,
}: {
  image: string;
  alt: string;
  className?: string;
}) {
  const [mainImageUrl, setMainImageUrl] = useState<string>("");
  useEffect(() => {
    async function main() {
      try {
        const res = await getSanityImage(image);
        setMainImageUrl(res.data.imageUrl);
      } catch (err: unknown) {
        const errorMessage = err as { message: string };
        console.log(errorMessage);
      }
    }
    main();
  });
  return (
    <Image
      src={mainImageUrl ?? ""}
      alt={alt}
      width={500}
      height={500}
      className={cn([className])}
    />
  );
}
