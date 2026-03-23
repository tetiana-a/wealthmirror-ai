export type BotMode = "SOFT" | "STRICT" | "BRUTAL";
export type AppLanguage = "EN" | "UK" | "CS";

export type DecisionAIResult = {
  verdict: "BUY" | "WAIT" | "DON'T BUY";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
  advice: string[];
  behaviorSignal: string;
  estimatedAmount?: number | null;
};
