import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, Heart, Zap } from "lucide-react"

export function AboutSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-sm px-3 py-1 bg-teal-400 text-white">
            About TripOtter
          </Badge>
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-balance">Connecting Travelers, Creating Memories</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xl leading-relaxed mb-8 text-muted-foreground">
              TripOtter was born from a simple belief: travel is better when shared. We're not just another social
              platform - we're a community of passionate explorers who believe that every journey has a story worth
              telling.
            </p>

            <p className="text-lg leading-relaxed mb-8 text-muted-foreground">
              From sharing breathtaking photos to getting personalized advice from Cappy, our AI companion, we've built
              every feature with one goal in mind: making your travel experiences richer, more connected, and absolutely
              unforgettable.
            </p>

            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-black text-primary mb-2">500K+</div>
                <div className="text-sm text-muted-foreground">Active Travelers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-primary mb-2">2M+</div>
                <div className="text-sm text-muted-foreground">Shared Moments</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-primary mb-2">150+</div>
                <div className="text-sm text-muted-foreground">Countries</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-primary mb-2">50+</div>
                <div className="text-sm text-muted-foreground">Travel Tribes</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Global Community</h3>
                    <p className="text-muted-foreground">
                      Connect with travelers from every corner of the world and discover destinations through authentic
                      local perspectives.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Heart className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Built with Love</h3>
                    <p className="text-muted-foreground">
                      Every feature is crafted with care by travelers, for travelers. We understand your needs because
                      we share your passion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Always Evolving</h3>
                    <p className="text-muted-foreground">
                      We're constantly innovating and adding new features based on your feedback to make your travel
                      experience even better.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
