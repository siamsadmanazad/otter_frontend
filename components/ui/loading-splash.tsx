const quotes = [
  "A network is your safety net, especially when you're a thousand miles from home.",
  "Travel is a breeze when you have friends in every time zone.",
  "The best travel guide isn't a book—it's a person who lives there.",
  "Networking is the key to unlocking the world's hidden gems.",
  "Travel becomes less about where you go and more about who you know.",
  "With a strong network, every destination feels a little more like home.",
  "Your connections are the compass that guides you to authentic travel experiences.",
  "The best souvenir from a trip is a lasting connection.",
  "Traveling with a network is like having a local friend in every city.",
  "Networking turns strangers into allies, and far-off lands into familiar places.",
  "Your network is the most valuable currency you have when you're on the road.",
  "The best way to get lost in a new city is to know someone who can help you find your way back.",
];

function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export function LoadingScreen() {
  const quote = getRandomQuote();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-900">
      <div className="text-center">
        <img
          src="/splash.jpg"
          alt="Logo"
          height="300"
          width="400"
          className="w-64 h-32 mx-auto mb-4"
        />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4 dark:border-blue-400"></div>
        <p className="text-gray-600 dark:text-gray-300">{quote}</p>
      </div>
    </div>
  );
}