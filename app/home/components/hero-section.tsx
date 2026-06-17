"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export function HeroSection() {
  const heroImages = [
    {
      url: "/backgrounds/stunning-mountain-landscape-with-lake-reflection-a.jpg",
      alt: "Mountain landscape with lake",
    },
    {
      url: "/backgrounds/tropical-beach-with-crystal-clear-water-and-palm-t.jpg",
      alt: "Tropical beach paradise",
    },
    {
      url: "/backgrounds/ancient-temple-ruins-in-jungle-with-golden-light.jpg",
      alt: "Ancient temple in jungle",
    },
    {
      url: "/backgrounds/northern-lights-aurora-over-snowy-landscape.jpg",
      alt: "Northern lights over snow",
    },
    {
      url: "/backgrounds/bustling-street-market-in-colorful-asian-city.jpg",
      alt: "Vibrant city street market",
    },
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        {heroImages.map((image, index) => (
          <div
            key={index}
            className={`fadeImage ${index === currentImageIndex ? "active" : ""}`}
            style={{ backgroundImage: `url('${image.url}')` }}
            aria-hidden={index !== currentImageIndex}
            aria-label={image.alt}
          >
            <div className="overlay" />
          </div>
        ))}
      </div>

      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
        {heroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentImageIndex(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentImageIndex
                ? "bg-white scale-110"
                : "bg-white/50 hover:bg-white/75"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black mb-6 text-balance">
          Connect, Share, Explore
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-balance opacity-90">
          Join the ultimate travel social platform where adventures come alive,
          friendships bloom, and every journey becomes a story worth sharing.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/login">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg"
            >
              Join the Adventure
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          {/* <Button
            variant="outline"
            size="lg"
            className="border-white text-white hover:bg-white hover:text-foreground px-8 py-4 text-lg bg-transparent"
          >
            <Play className="mr-2 h-5 w-5" />
            Watch Demo
          </Button> */}
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse" />
        </div>
      </div>

      {/* Styled JSX for CSS */}
      <style jsx>{`
        .fadeImage {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          opacity: 0;
          transition: opacity 1s ease-in-out;
          will-change: opacity;
          z-index: 0;
        }

        .active {
          opacity: 1;
          z-index: 1;
        }

        .overlay {
          position: absolute;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </section>
  );
}
