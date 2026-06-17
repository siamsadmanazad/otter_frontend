import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";

export function AIAssistantSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-balance">
              Meet Cappy, Your AI Travel Companion
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Our caring capybara AI assistant is here to help you plan the
              perfect trip, discover hidden gems, and answer all your travel
              questions. Cappy knows the world like the back of his paw and is
              always ready to share insider tips!
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">
                    Personalized Recommendations
                  </h3>
                  <p className="text-muted-foreground">
                    Get tailored suggestions based on your travel style and
                    preferences.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">
                    Real-time Travel Advice
                  </h3>
                  <p className="text-muted-foreground">
                    Ask about weather, local customs, safety tips, and more.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">
                    Trip Planning Assistant
                  </h3>
                  <p className="text-muted-foreground">
                    Let Cappy help you create the perfect itinerary for your
                    next adventure.
                  </p>
                </div>
              </div>
            </div>

            <Link href="/login">
              <Button
                size="lg"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Chat with Cappy
              </Button>
            </Link>
          </div>

          <div className="relative">
            <Card className="bg-gradient-to-br from-slate-400/70 to-slate-700/70 border-10 border-blue-500">
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-teal-400 flex items-center justify-center border-10 border-blue-500">
                    <img
                      src="/assets/cappy.png"
                      alt="Cappy the Capybara"
                      className="w-24 h-24 rounded-full"
                    />
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-lg max-w-sm mx-auto">
                    <p className="text-sm text-foreground">
                      "Hey there, fellow explorer! 🌍 I'm Cappy, and I'm here to
                      make your travels amazing. Ask me anything about your next
                      adventure - I've got tons of tips to share!"
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
