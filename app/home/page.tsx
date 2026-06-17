import { AuthChecker } from "./components/auth-checker";
import { HeroSection } from "./components/hero-section";
import { FeaturesSection } from "./components/features-section";
import { AIAssistantSection } from "./components/ai-assistant-section";
import { TribesSection } from "./components/tribes-section";
import { ComingSoonSection } from "./components/coming-soon-section";
import { MisspellingWordCloud } from"./components/misspelling-wordcloud";
import { AboutSection } from "./components/about-section";
import { Footer } from "./components/footer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "Home | Tripotter",
    default: "Tripotter",
  },
  description:
    "Tripotter is a social media platform for travelers to share their adventures, discover new destinations, and connect with fellow explorers.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <AIAssistantSection />
      <TribesSection />
      <ComingSoonSection />
      <MisspellingWordCloud />
      <AboutSection />
      <Footer />
      <AuthChecker />
    </main>
  );
}
