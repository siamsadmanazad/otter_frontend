const stories = [
    { id: 1, username: "Your story", avatar: "/placeholder.svg?height=60&width=60", hasStory: false, isOwn: true },
    { id: 2, username: "john_doe", avatar: "/placeholder.svg?height=60&width=60", hasStory: true },
    { id: 3, username: "jane_smith", avatar: "/placeholder.svg?height=60&width=60", hasStory: true },
    { id: 4, username: "travel_blog", avatar: "/placeholder.svg?height=60&width=60", hasStory: true },
    { id: 5, username: "food_lover", avatar: "/placeholder.svg?height=60&width=60", hasStory: true },
    { id: 6, username: "tech_news", avatar: "/placeholder.svg?height=60&width=60", hasStory: true },
    { id: 7, username: "art_gallery", avatar: "/placeholder.svg?height=60&width=60", hasStory: true },
    { id: 8, username: "music_vibes", avatar: "/placeholder.svg?height=60&width=60", hasStory: true },
  ]
  
  const posts = [
    {
      id: 1,
      username: "nature_photographer",
      avatar: "/placeholder.svg?height=32&width=32",
      image: "/placeholder.svg?height=400&width=400",
      likes: 1234,
      caption:
        "Golden hour magic in the mountains 🏔️✨ There's nothing quite like watching the sun set behind these majestic peaks.",
      comments: [
        { username: "john_doe", text: "Absolutely stunning! 😍" },
        { username: "jane_smith", text: "This is incredible! Where was this taken?" },
        { username: "mountain_lover", text: "I need to visit this place!" },
      ],
      timeAgo: "2 hours ago",
    },
    {
      id: 2,
      username: "food_enthusiast",
      avatar: "/placeholder.svg?height=32&width=32",
      image: "/placeholder.svg?height=400&width=400",
      likes: 856,
      caption: "Homemade pasta night 🍝 Recipe in my bio! Nothing beats fresh pasta made from scratch.",
      comments: [
        { username: "chef_mike", text: "Looks delicious! 🤤" },
        { username: "pasta_lover", text: "Need this recipe ASAP!" },
      ],
      timeAgo: "4 hours ago",
    },
    {
      id: 3,
      username: "street_artist",
      avatar: "/placeholder.svg?height=32&width=32",
      image: "/placeholder.svg?height=400&width=400",
      likes: 2156,
      caption: "New mural downtown! Art brings life to the city 🎨 Spent 3 days working on this piece.",
      comments: [
        { username: "art_lover", text: "Your work is amazing!" },
        { username: "city_explorer", text: "I saw this today, so cool!" },
        { username: "mural_fan", text: "Best street art in the city!" },
      ],
      timeAgo: "6 hours ago",
    },
    {
      id: 4,
      username: "coffee_addict",
      avatar: "/placeholder.svg?height=32&width=32",
      image: "/placeholder.svg?height=400&width=400",
      likes: 543,
      caption: "Perfect latte art to start the morning ☕️ My barista skills are finally improving!",
      comments: [
        { username: "coffee_lover", text: "That foam art is perfect!" },
        { username: "morning_person", text: "Now I want coffee!" },
      ],
      timeAgo: "8 hours ago",
    },
  ]
  
  const suggestedUsers = [
    {
      username: "alex_photos",
      name: "Alex Photography",
      avatar: "/placeholder.svg?height=32&width=32",
      mutualFollowers: 3,
    },
    {
      username: "design_studio",
      name: "Creative Studio",
      avatar: "/placeholder.svg?height=32&width=32",
      mutualFollowers: 7,
    },
    {
      username: "travel_couple",
      name: "Sarah & Mike",
      avatar: "/placeholder.svg?height=32&width=32",
      mutualFollowers: 12,
    },
    {
      username: "fitness_guru",
      name: "Fitness Coach",
      avatar: "/placeholder.svg?height=32&width=32",
      mutualFollowers: 5,
    },
  ]
  export {
    suggestedUsers,
    posts,
    stories,
  }