import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mountain,
  Utensils,
  Camera,
  Backpack,
  Waves,
  Building,
  Users,
} from "lucide-react";
import Link from "next/link";

const tribes = [
  {
    icon: Mountain,
    name: "Adventure Seekers",
    description:
      "For thrill-seekers who love extreme sports, hiking, and adrenaline-pumping activities.",
    members: "12.5K",
    color: "bg-red-500",
  },
  {
    icon: Utensils,
    name: "Food Explorers",
    description:
      "Discover local cuisines, hidden restaurants, and culinary adventures around the world.",
    members: "8.3K",
    color: "bg-orange-500",
  },
  {
    icon: Camera,
    name: "Photo Wanderers",
    description:
      "Capture stunning landscapes and share photography tips with fellow visual storytellers.",
    members: "15.7K",
    color: "bg-purple-500",
  },
  {
    icon: Backpack,
    name: "Budget Travelers",
    description:
      "Share money-saving tips, budget accommodations, and affordable travel hacks.",
    members: "9.8K",
    color: "bg-green-500",
  },
  {
    icon: Waves,
    name: "Beach Lovers",
    description:
      "Find the best beaches, water activities, and coastal destinations worldwide.",
    members: "11.2K",
    color: "bg-blue-500",
  },
  {
    icon: Building,
    name: "City Explorers",
    description:
      "Navigate urban jungles, discover city culture, and find the best metropolitan experiences.",
    members: "7.9K",
    color: "bg-gray-500",
  },
];

export function TribesSection() {
  return (
    <section className="py-20 px-4 bg-card">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-balance">
            Find Your Travel Tribe
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            Connect with travelers who share your passion. Join specialized
            communities and grow your network with like-minded explorers from
            around the globe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tribes.map((tribe, index) => (
            <Card
              key={index}
              className="border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 ${tribe.color} rounded-lg flex items-center justify-center`}
                  >
                    <tribe.icon className="h-6 w-6 text-white" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Users className="h-3 w-3" />
                    {tribe.members}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{tribe.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed mb-6">
                  {tribe.description}
                </CardDescription>
                <Link href="/login">
                  <Button className="w-full bg-transparent">Join Tribe</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
