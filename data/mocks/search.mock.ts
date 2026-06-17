import {
  Users,
  Hash,
  MapPin,
  User,
} from "lucide-react";

export const mockSearchData = {
  people: [
    {
      id: 1,
      username: "john_traveler",
      name: "John Smith",
      avatar: "/placeholder.svg",
      followers: "12.5K",
      verified: true,
    },
    {
      id: 2,
      username: "sarah_explorer",
      name: "Sarah Johnson",
      avatar: "/placeholder.svg",
      followers: "8.2K",
      verified: false,
    },
    {
      id: 3,
      username: "mike_photographer",
      name: "Mike Wilson",
      avatar: "/placeholder.svg",
      followers: "25.1K",
      verified: true,
    },
    {
      id: 4,
      username: "emma_foodie",
      name: "Emma Davis",
      avatar: "/placeholder.svg",
      followers: "15.7K",
      verified: false,
    },
  ],
  hashtags: [
    { tag: "travel", posts: "2.5M" },
    { tag: "photography", posts: "1.8M" },
    { tag: "food", posts: "3.2M" },
    { tag: "adventure", posts: "950K" },
    { tag: "nature", posts: "1.2M" },
  ],
  locations: [
    { id: 1, name: "Paris, France", posts: "850K" },
    { id: 2, name: "Tokyo, Japan", posts: "1.2M" },
    { id: 3, name: "New York, USA", posts: "2.1M" },
    { id: 4, name: "Bali, Indonesia", posts: "650K" },
  ],
  groups: [
    {
      id: 1,
      name: "Travel Photography",
      members: "45.2K",
      avatar: "/placeholder.svg",
      category: "Photography",
    },
    {
      id: 2,
      name: "Backpackers United",
      members: "32.8K",
      avatar: "/placeholder.svg",
      category: "Travel",
    },
    {
      id: 3,
      name: "Food Explorers",
      members: "28.5K",
      avatar: "/placeholder.svg",
      category: "Food",
    },
    {
      id: 4,
      name: "Adventure Seekers",
      members: "51.3K",
      avatar: "/placeholder.svg",
      category: "Adventure",
    },
  ],
  shops: [
    {
      id: 1,
      name: "Travel Gear Pro",
      rating: 4.8,
      products: "1.2K",
      avatar: "/placeholder.svg",
      category: "Travel Gear",
    },
    {
      id: 2,
      name: "Local Crafts Store",
      rating: 4.6,
      products: "850",
      avatar: "/placeholder.svg",
      category: "Crafts",
    },
    {
      id: 3,
      name: "Adventure Equipment",
      rating: 4.9,
      products: "2.1K",
      avatar: "/placeholder.svg",
      category: "Equipment",
    },
    {
      id: 4,
      name: "Souvenir Paradise",
      rating: 4.4,
      products: "650",
      avatar: "/placeholder.svg",
      category: "Souvenirs",
    },
  ],
};

export const recentSearches = [
  { type: "person", query: "john_traveler", icon: User },
  { type: "hashtag", query: "#travel", icon: Hash },
  { type: "location", query: "Paris, France", icon: MapPin },
  { type: "group", query: "Travel Photography", icon: Users },
];

export const trendingSearches = [
  "#wanderlust",
  "#foodie",
  "#photography",
  "Tokyo",
  "Adventure",
  "#sunset",
];
