"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GridMedia({ media, className }: { media: string[], className?: string }) {
  let mediaLinks: string[] = [];
  media.forEach((item) => {
    if (typeof item === "string" && item.includes("https://")) {
      mediaLinks.push(item);
    }
  });

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  if (mediaLinks.length === 0) {
    return <div>&nbsp;</div>;
  }

  const openModal = (index: number) => {
    setSelectedMediaIndex(index);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  const goToNext = () => {
    setSelectedMediaIndex((prevIndex) => (prevIndex + 1) % mediaLinks.length);
  };

  const goToPrevious = () => {
    setSelectedMediaIndex(
      (prevIndex) => (prevIndex - 1 + mediaLinks.length) % mediaLinks.length
    );
  };

  const renderMediaItem = (
    item: string,
    index: number,
    className: string = "w-full h-full object-cover rounded-md",
    clickable: boolean = true
  ) => {
    const mediaElement = item.includes("mp4") ? (
      <video key={index} src={item} controls className={className} />
    ) : (
      <img
        key={index}
        src={item}
        alt={`Media ${index}`}
        className={className}
      />
    );

    if (clickable) {
      return (
        <div
          onClick={() => openModal(index)}
          className="cursor-pointer w-full h-full"
        >
          {mediaElement}
        </div>
      );
    }
    return mediaElement;
  };

  return (
    <div className={ className ? className : ""}>
      {mediaLinks.length === 1 ? (
        <div className="w-full">{renderMediaItem(mediaLinks[0], 0)}</div>
      ) : mediaLinks.length >= 5 ? (
        <Carousel className="w-full mt-4 relative">
          <CarouselContent className="-ml-1">
            {mediaLinks.map((item, index) => (
              <CarouselItem
                key={index}
                className="pl-1 md:basis-1/2 lg:basis-1/3"
              >
                <div className="p-1">
                  <Card className="rounded-lg overflow-hidden">
                    <CardContent className="flex aspect-square items-center justify-center p-0">
                      {renderMediaItem(
                        item,
                        index,
                        "w-full h-full object-cover"
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-10" />
          <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-10" />
        </Carousel>
      ) : (
        <div className="grid grid-cols-2 gap-4 mt-4">
          {mediaLinks.map((item, index) => (
            <div key={index} className="relative aspect-square">
              {renderMediaItem(item, index)}
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalIsOpen} onOpenChange={setModalIsOpen}>
        <DialogContent className="sm:max-w-[calc(100vw-40px)] md:max-w-[calc(100vw-80px)] lg:max-w-[calc(100vw-120px)] xl:max-w-[calc(100vw-160px)] max-h-[90vh] p-0 border-none bg-transparent flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <DialogClose asChild>
              <Button
                className="absolute top-4 right-4 z-50 bg-gray-800 text-white rounded-full p-2 hover:bg-gray-700"
                size="icon"
              >
                <X className="w-6 h-6" />
              </Button>
            </DialogClose>

            {mediaLinks.length > 1 && (
              <Button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-gray-800 text-white rounded-full p-2 hover:bg-gray-700"
                size="icon"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
            )}

            <div className="max-w-full max-h-full flex items-center justify-center">
              {renderMediaItem(
                mediaLinks[selectedMediaIndex],
                selectedMediaIndex,
                "max-w-full max-h-full object-contain",
                false
              )}
            </div>

            {mediaLinks.length > 1 && (
              <Button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-gray-800 text-white rounded-full p-2 hover:bg-gray-700"
                size="icon"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
