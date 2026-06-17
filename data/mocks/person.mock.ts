const personData = {
    "1": {
        username: "alex_wanderer",
        name: "Alex Thompson",
        avatar: "/placeholder.svg?height=150&width=150",
        coverImage: "/placeholder.svg?height=200&width=800",
        followers: "125K",
        following: "892",
        posts: "1.2K",
        bio: "Travel photographer & storyteller 📸\nCurrently exploring the hidden gems of Southeast Asia 🌴\nSharing stories one frame at a time ✨",
        location: "Bali, Indonesia",
        website: "alexwanderer.com",
        joinDate: "March 2020",
        verified: true,
        category: "Travel",
        isFollowing: false,
        stats: {
            totalLikes: "2.5M",
            avgLikes: "2.1K",
            engagement: "8.5%",
        },
    },
}

const posts = [
    {
        id: 1,
        image: "/placeholder.svg?height=400&width=400",
        likes: 2156,
        comments: [
            { username: "sarah_explorer", text: "This is absolutely stunning! 😍" },
            { username: "mike_photographer", text: "Amazing composition!" },
        ],
        caption:
            "Golden hour magic in the rice terraces of Bali 🌅 Sometimes the best moments happen when you least expect them. This shot was completely unplanned - I was just walking back to my hotel when the light hit perfectly.",
        timeAgo: "2 hours ago",
        location: "Jatiluwih, Bali",
    },
    {
        id: 2,
        image: "/placeholder.svg?height=400&width=400",
        likes: 1834,
        comments: [
            { username: "foodie_emma", text: "I need this recipe! 🤤" },
            { username: "bangkok_local", text: "Best pad thai in the city!" },
        ],
        caption:
            "Street food adventures in Bangkok! This pad thai changed my life 🍜 The vendor has been perfecting this recipe for 30 years and you can taste every bit of that experience. #StreetFood #Bangkok",
        timeAgo: "1 day ago",
        location: "Bangkok, Thailand",
    },
    {
        id: 3,
        image: "/placeholder.svg?height=400&width=400",
        likes: 3421,
        comments: [
            { username: "hiker_tom", text: "Worth the early wake up call!" },
            { username: "sunrise_chaser", text: "Incredible view! 🏔️" },
            { username: "bali_guide", text: "One of the best sunrise spots!" },
        ],
        caption:
            "Sunrise from Mount Batur was absolutely breathtaking! Worth every step of the 4am hike 🏔️ There's something magical about watching the world wake up from 1,717 meters above sea level.",
        timeAgo: "3 days ago",
        location: "Mount Batur, Bali",
    },
    {
        id: 4,
        image: "/placeholder.svg?height=400&width=400",
        likes: 1567,
        comments: [
            { username: "ocean_lover", text: "Beautiful blue hour shot!" },
            { username: "local_fisherman", text: "Thank you for capturing our work!" },
        ],
        caption:
            "Local fishermen at work during blue hour. Their dedication is truly inspiring 🎣 Started their day at 4am and still going strong as the sun sets. Respect for these hardworking souls.",
        timeAgo: "5 days ago",
        location: "Sanur Beach, Bali",
    },
    {
        id: 5,
        image: "/placeholder.svg?height=400&width=400",
        likes: 2890,
        comments: [
            { username: "nature_lover", text: "Hidden gems are the best! 💚" },
            { username: "waterfall_hunter", text: "Adding this to my list!" },
        ],
        caption:
            "Hidden waterfall discovered during today's jungle trek! Nature never ceases to amaze me 💚 After 3 hours of hiking through dense jungle, this was the perfect reward. The sound of the water was absolutely therapeutic.",
        timeAgo: "1 week ago",
        location: "Sekumpul Falls, Bali",
    },
    {
        id: 6,
        image: "/placeholder.svg?height=400&width=400",
        likes: 1245,
        comments: [
            { username: "culture_enthusiast", text: "Beautiful traditions! 🙏" },
            { username: "temple_guide", text: "Thank you for respecting our culture" },
        ],
        caption:
            "Traditional Balinese ceremony at the local temple. Such rich culture and beautiful traditions 🙏 Feeling grateful to witness and document these sacred moments with permission from the local community.",
        timeAgo: "1 week ago",
        location: "Tanah Lot, Bali",
    },
]
const mockPosts = [
    {
        id: 1,
        image: "/placeholder.svg?height=400&width=400",
        likes: 3420,
        comments: 156,
        caption:
            "Golden hour magic at Tanah Lot Temple 🌅 The way the light dances on the ancient stones never gets old. This place holds so much history and spiritual energy.",
        timeAgo: "2 hours ago",
        location: "Tanah Lot, Bali",
    },
    {
        id: 2,
        image: "/placeholder.svg?height=400&width=400",
        likes: 2890,
        comments: 98,
        caption:
            "Rice terraces of Jatiluwih - a UNESCO World Heritage site that showcases the incredible ingenuity of Balinese farmers. The morning mist makes everything look ethereal ✨",
        timeAgo: "1 day ago",
        location: "Jatiluwih, Bali",
    },
    {
        id: 3,
        image: "/placeholder.svg?height=400&width=400",
        likes: 4156,
        comments: 234,
        caption:
            "Street food adventures in Ubud! This nasi gudeg from a local warung is absolutely incredible. Sometimes the best meals come from the most unexpected places 🍛",
        timeAgo: "3 days ago",
        location: "Ubud, Bali",
    },
    {
        id: 4,
        image: "/placeholder.svg?height=400&width=400",
        likes: 1876,
        comments: 67,
        caption:
            "Sunrise hike to Mount Batur was challenging but so worth it! Nothing beats watching the world wake up from 1,717 meters above sea level 🏔️",
        timeAgo: "5 days ago",
        location: "Mount Batur, Bali",
    },
]

const mockFollowers = [
    {
        id: 1,
        name: "Sarah Explorer",
        username: "sarah_explorer",
        avatar: "/placeholder.svg?height=40&width=40",
        isVerified: true,
        followers: "45K",
        bio: "Adventure seeker & nature photographer",
    },
    {
        id: 2,
        name: "Mike Chen",
        username: "mike_photographer",
        avatar: "/placeholder.svg?height=40&width=40",
        isVerified: false,
        followers: "12K",
        bio: "Street photographer based in Tokyo",
    },
    {
        id: 3,
        name: "Emma Wilson",
        username: "emma_foodie",
        avatar: "/placeholder.svg?height=40&width=40",
        isVerified: true,
        followers: "89K",
        bio: "Food blogger & recipe creator",
    },
    {
        id: 4,
        name: "David Kim",
        username: "david_traveler",
        avatar: "/placeholder.svg?height=40&width=40",
        isVerified: false,
        followers: "23K",
        bio: "Digital nomad exploring Asia",
    },
    {
        id: 5,
        name: "Lisa Rodriguez",
        username: "lisa_yoga",
        avatar: "/placeholder.svg?height=40&width=40",
        isVerified: true,
        followers: "67K",
        bio: "Yoga instructor & wellness coach",
    },
]

const highlights = [
    { id: 1, title: "Bali Adventures", cover: "/placeholder.svg?height=80&width=80", count: 12 },
    { id: 2, title: "Street Food", cover: "/placeholder.svg?height=80&width=80", count: 8 },
    { id: 3, title: "Sunrises", cover: "/placeholder.svg?height=80&width=80", count: 15 },
    { id: 4, title: "Local Culture", cover: "/placeholder.svg?height=80&width=80", count: 6 },
]

const mutualFollowers = [
    { username: "sarah_explorer", avatar: "/placeholder.svg?height=32&width=32" },
    { username: "mike_photographer", avatar: "/placeholder.svg?height=32&width=32" },
    { username: "emma_foodie", avatar: "/placeholder.svg?height=32&width=32" },
]

export {
    personData,
    highlights,
    mutualFollowers,
    mockFollowers,
    mockPosts,
    posts
}