import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, MapPin, Heart, Users, Star, AlertTriangle, MessageCircle, Bot, Route } from "lucide-react"

const features = [
  {
    icon: Camera,
    title: "Share Images & Videos",
    bgColor: "bg-yellow-500",
    description:
      "Capture and share your travel moments with stunning photos and videos that bring your adventures to life.",
  },
  {
    icon: MapPin,
    title: "Location Sharing",
    bgColor: "bg-blue-500",
    description: "Tag your exact location on posts and let friends discover amazing places through your journey.",
  },
  {
    icon: Heart,
    title: "Reactions & Growth",
    bgColor: "bg-red-500",
    description:
      "Your reactions help grow your profile and assist fellow travelers in discovering the best experiences.",
  },
  {
    icon: Users,
    title: "Join Tribes",
    bgColor: "bg-green-500",
    description: "Connect with like-minded travelers in specialized tribes and grow your network the way you want.",
  },
  {
    icon: Star,
    title: "Reviews & Feedback",
    bgColor: "bg-orange-500",
    description: "Share honest reviews of places and experiences to help the community make better travel decisions.",
  },
  {
    icon: AlertTriangle,
    title: "Issue Reporting",
    bgColor: "bg-red-500",
    description: "Report issues and track their resolution status. Help us improve the platform for everyone.",
  },
  {
    icon: MessageCircle,
    title: "Live Chatting",
    bgColor: "bg-purple-500",
    description: "Connect instantly with fellow travelers through real-time messaging and group conversations.",
  },
  {
    icon: Bot,
    title: "Ask Cappy AI",
    bgColor: "bg-pink-500",
    description:
      "Get personalized travel advice from Cappy, our caring capybara AI assistant who knows all about adventures.",
  },
  {
    icon: Route,
    title: "Journey Tracking",
    bgColor: "bg-blue-500",
    description: "Visualize your travel journey and see all the amazing places you've visited through your posts.",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 bg-card">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-balance">Everything You Need for Epic Adventures</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            Discover powerful features designed to enhance your travel experience and connect you with a global
            community of explorers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => 
          (
            <Card key={index} className="border-border hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className={`w-12 h-12 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          )
          )}
        </div>
      </div>
    </section>
  )
}
