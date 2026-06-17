"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2 } from "lucide-react";
import { ai } from "@/lib/gemini";
import { Textarea } from "@/components/ui/textarea";
import { AIResponse } from "@/components/ai-response";

export function AiSuggestionTab() {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const handleGenerateAIResponse = async () => {
    if (!aiPrompt.trim()) {
      setAiError("Please enter a prompt for AI suggestions.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiResponse(null);

    try {
      const response = await ai(aiPrompt);
      if (response) {
        setAiResponse(response);
      } else {
        setAiError("Failed to get AI suggestions. Please try again.");
      }
    } catch (err) {
      console.error("Error calling AI:", err);
      setAiError("An unexpected error occurred while generating suggestions.");
    } finally {
      setAiLoading(false);
    }
  };
  return (
    <div className="space-y-4">
      {aiResponse ? (
        <Button
          className="w-full rounded-md"
          onClick={() => {
            setAiPrompt("");
            setAiResponse(null);
            setAiError(null);
          }}
        >
          Ask another question?
        </Button>
      ) : (
        <Textarea
          placeholder="Tell me about your travel preferences, e.g., 'I want a relaxing beach vacation in Europe with good seafood and historical sites.'"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          className="min-h-[100px] rounded-md"
        />
      )}
      {aiResponse ? (
        <div></div>
      ) : (
        <Button
          onClick={handleGenerateAIResponse}
          disabled={aiLoading}
          className="w-full rounded-md"
        >
          {aiLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Ask AI
            </>
          )}
        </Button>
      )}

      {aiError && <div className="text-red-500 text-sm mt-2">{aiError}</div>}
      {aiResponse && <AIResponse answer={aiResponse} />}
    </div>
  );
}
