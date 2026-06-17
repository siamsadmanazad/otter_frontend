import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Store, Package, Plane, Search, ShoppingCart, TrendingUp } from "lucide-react"

const comingSoonFeatures = [
  {
    icon: Store,
    title: "Create Your Business",
    description: "Launch your travel business on our platform - completely free and always will be.",
    badge: "Free Forever",
    bgColor: "bg-green-500",
    badgeBgColor: "bg-green-500"
  },
  {
    icon: Package,
    title: "Show Off Your Inventory",
    description: "Display your travel products, services, and experiences to a global audience.",
    badge: "For Businesses",
    bgColor: "bg-blue-500",
    badgeBgColor: "bg-blue-500"
  },
  {
    icon: Plane,
    title: "Travel Agencies Welcome",
    description: "Special features and tools designed specifically for travel agencies and tour operators.",
    badge: "Professional",
    bgColor: "bg-orange-500",
    badgeBgColor: "bg-orange-500"
  },
  {
    icon: Search,
    title: "Smart Seller Search",
    description: "Find the best deals with our intelligent search that sorts sellers by price - cheapest first!",
    badge: "Price Sorted",
    bgColor: "bg-yellow-500",
    badgeBgColor: "bg-yellow-500"
  },
  {
    icon: ShoppingCart,
    title: "Package Discovery",
    description: "Discover travel packages sorted by trust score - we show you the most reliable options first.",
    badge: "Trust Verified",
    bgColor: "bg-purple-500",
    badgeBgColor: "bg-purple-500"
  },
  {
    icon: TrendingUp,
    title: "Business Analytics",
    description: "Comprehensive insights and analytics to help your travel business grow and succeed.",
    badge: "Data Driven",
    bgColor: "bg-red-500",
    badgeBgColor: "bg-red-500"
  },
]

export function ComingSoonSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-sm px-3 py-1">
            Coming Soon
          </Badge>
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-balance">The Future of Travel Business</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            We're building powerful tools to help travel businesses thrive. Get ready for features that will
            revolutionize how you buy and sell travel experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {comingSoonFeatures.map((feature, index) => (
            <Card key={index} className="border-border relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <Badge className={`text-xs ${feature.badgeBgColor}`}>
                  {feature.badge}
                </Badge>
              </div>
              <CardHeader>
                <div className={`w-12 h-12 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl pr-16">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
