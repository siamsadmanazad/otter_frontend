import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const misspellings = [
  { text: "TripOtter", size: "text-4xl", correct: true },
  { text: "TripOter", size: "text-2xl" },
  { text: "TripOttr", size: "text-xl" },
  { text: "TripOttter", size: "text-3xl" },
  { text: "TripOder", size: "text-lg" },
  { text: "Trip Otter", size: "text-2xl", correct: true },
  { text: "TripOttar", size: "text-xl" },
  { text: "TripOter.org", size: "text-lg" },
  { text: "TripOttter", size: "text-2xl" },
  { text: "TripOder.com", size: "text-xl" },
  { text: "TripOtter.net", size: "text-3xl", correct: true },
  { text: "TripOtar", size: "text-lg" },
  { text: "TripOttr.net", size: "text-2xl" },
  { text: "TripOder", size: "text-lg" },
  { text: "TripOttter.org", size: "text-xl" },
];

export function MisspellingWordCloud() {
  return (
    <section className="py-20 px-4 bg-card">
      <div className="max-w-4xl mx-auto">
        <Card className="border-border shadow-md shadow-teal-400">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-black mb-4">However You Spell It, We Know You Mean Us! 😄</CardTitle>
            <p className="text-muted-foreground text-lg">
              Don't worry about getting it perfect - we've seen every variation imaginable!
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center items-center gap-4 p-8">
              {misspellings.map((word, index) => (
                <h1
                  key={index}
                  className={`
                    ${word.size} font-bold transition-all duration-300 hover:scale-110 cursor-default
                    ${
                      word.correct
                        ? "text-primary hover:text-primary/80"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  style={{
                    transform: `rotate(${Math.random() * 20 - 10}deg)`,
                  }}
                >
                  {word.text}
                </h1>
              ))}
            </div>

            <div className="flex flex-col md:flex-row text-center mt-8 mx-auto justify-center gap-8">
              <img src="/assets/ai-section-left.png" height={350} width={280} alt="left" className="h-32 w-28" />
              <p className="text-sm text-muted-foreground mt-0 md:mt-12">
                <span className="text-primary font-semibold">TripOtter</span> is the correct spelling, but we love all
                the creative attempts! 🦦
              </p>
              <img src="/assets/ai-section-right.png" height={350} width={300} alt="left" className="h-32 w-32 ml-[45vw] sm:ml-[55vw] md:ml-0" />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
