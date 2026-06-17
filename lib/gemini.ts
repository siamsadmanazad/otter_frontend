"use server";
import { GoogleGenAI } from "@google/genai";

function prompt_response_validation(response: any): boolean {
  return (
    typeof response === "object" &&
    Array.isArray(response.suggestions) &&
    response.suggestions.length >= 4 &&
    response.suggestions.length <= 16 &&
    Array.isArray(response.highlight) &&
    response.highlight.length >= 3 &&
    response.highlight.length <= 12 &&
    response.highlight.every((h: any) => typeof h === "string") &&
    response.highlight.every((h: any) => response.suggestions.includes(h))
  );
}

export async function ai(
  prompt: string,
  retries = 3
): Promise<any> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing API key");
    return null;
  }

  const aiClient = new GoogleGenAI({ apiKey });

  // Loop for retries
  for (let i = 0; i < retries; i++) {
    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash-lite-preview-06-17",
        contents: `
          For the time being, your name is Cappy and you got a combination of gpt, deepseek and mistral under the hood. 
          You are a highly creative and experienced travel guide and agent. Your answers are short and concise. You should also suggest the website links of promiment hotels and restaurants there.

          You will be given a question from a user who is seeking travel suggestions. The question might be specific ("Where should I go for a solo weekend trip in Europe?") or vague ("I want to escape the city for a bit").

          Your job is to respond with imaginative, relevant, and practical travel ideas. Make sure your suggestions are personalized to the tone and intent of the question — be playful, adventurous, luxurious, remote, etc., based on what the user seems to want.
          Do keep a good focus on food, what foods are available there, in the restaurants, local providers or other and the best places to eat. Also suggest the best places to stay and the best activities to do.
          Also suggest hospitals or clinics in case of accidents or emergencies. Also suggest what dangers are available. You should also suggest the website links of promiment hotels and restaurants there. Also suggest how much money they require for whatever activity there exists.

          You must return your answer strictly as a valid stringified JSON object with the following keys:
          - "places": 3-4 places that you think are trendy and most exiciting places to visit
          - "foods": 2-3 foods that you think are trendy and cultural foods to try on the places
          - "activities": 3-4 activities that you think are trendy and fun activities to do on the places
          - "cautions": 2-3 things that users should avoid, if there are any dangers, do let them know
          - "commute": 2-3 things that users should know about the commute, if there are any dangers, do let them know
          - "enjoyment": 2-3 things that users will most enjoy

          response structure should look like this,
          interface IAnswerProps {
            places: string[];
            foods: string[];
            activities: string[];
            cautions: string[];
            commute: string[];
            enjoyment: string[];
          }

          Respond in the same language as the question. Make it short and concise.
          No commentary, no formatting — only the stringified JSON object.

          The user’s question:
          ${prompt}
        `,
      });

      const text = response.text ?? "";
      let parsed;

      // --- Throughput and Validation Improvement ---
      // Extract JSON string from markdown code block if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : text;

      try {
        parsed = JSON.parse(jsonString);
      } catch (error) {
        console.warn("Failed to parse response JSON. Retrying...", error);
        // Add a small delay before retrying to prevent rapid-fire requests
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1-second delay
        }
        continue; // Continue to the next retry attempt
      }

    //   if (!prompt_response_validation(parsed)) {
    //     console.warn("Response failed validation. Retrying...", parsed);
    //     // Add a small delay before retrying to prevent rapid-fire requests
    //     if (i < retries - 1) {
    //       await new Promise((resolve) => setTimeout(resolve, 1000)); // 1-second delay
    //     }
    //     continue; // Continue to the next retry attempt
    //   }

    //   console.log(parsed);
      return parsed; // Return successfully parsed and validated response
    } catch (error) {
      console.error("API Error:", error);
      // Add a small delay before retrying on API errors
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1-second delay
      } else {
        return null; // Return null if all retries fail due to API error
      }
    }
  }

  return null; // Fallback return if all retries fail
}
