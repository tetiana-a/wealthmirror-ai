import OpenAI from "openai";
import { config } from "./config";
import { AppLanguage, BotMode, DecisionAIResult } from "./types";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

function getModeStyle(mode: BotMode): string {
  if (mode === "SOFT") return "Supportive, calm, concise, encouraging.";
  if (mode === "STRICT") return "Direct, rational, disciplined, practical.";
  return "Blunt, sharp, high-pressure, tough-love, but never insulting.";
}

function getLanguageInstruction(language: AppLanguage): string {
  if (language === "UK") return "Respond in Ukrainian.";
  if (language === "CS") return "Respond in Czech.";
  return "Respond in English.";
}

export async function analyzeDecision(input: {
  text: string;
  mode: BotMode;
  memorySummary: string;
  language: AppLanguage;
}): Promise<DecisionAIResult> {
  const systemPrompt = `
You are WealthMirror AI, a financial decision assistant inside Telegram.
Your task is to analyze whether a user should spend money or wait.

${getLanguageInstruction(input.language)}

Rules:
- Focus on necessity, emotional spending, urgency, opportunity cost, habits, and risk.
- Be practical and concise.
- Consider historical patterns if provided.
- Keep advice concrete and realistic.
- Return valid JSON only.

Response style:
${getModeStyle(input.mode)}

Memory summary:
${input.memorySummary || "No prior history available."}

JSON format:
{
  "verdict": "BUY" | "WAIT" | "DON'T BUY",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "category": "string",
  "urgency": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": "short paragraph",
  "advice": ["tip 1", "tip 2", "tip 3"],
  "behaviorSignal": "short sentence",
  "estimatedAmount": null
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: input.text }
    ]
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    verdict: parsed.verdict || "WAIT",
    riskLevel: parsed.riskLevel || "MEDIUM",
    category: parsed.category || "General",
    urgency: parsed.urgency || "MEDIUM",
    reasoning: parsed.reasoning || "No reasoning available.",
    advice: Array.isArray(parsed.advice) ? parsed.advice : [],
    behaviorSignal: parsed.behaviorSignal || "No behavior signal.",
    estimatedAmount: parsed.estimatedAmount ?? null
  };
}

export async function buildProfile(input: { history: string; language: AppLanguage }): Promise<string> {
  const prompt = `
You are a financial behavior analyst.
${getLanguageInstruction(input.language)}

Analyze the user's decision history and write a short Financial DNA profile.

Include:
1. spending style
2. biggest risk pattern
3. strongest improvement recommendation
4. one short motivating conclusion

Keep it concise and practical.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: input.history || "No history yet." }
    ]
  });

  return response.choices[0]?.message?.content || "No profile available.";
}

export async function buildWeeklySummary(input: { history: string; language: AppLanguage }): Promise<string> {
  const prompt = `
You are a financial AI analyst.
${getLanguageInstruction(input.language)}

Create a short weekly summary of the user's recent financial decisions.

Include:
- dominant spending pattern
- risk trend
- best improvement for next 7 days

Keep it short and useful.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: input.history || "No history yet." }
    ]
  });

  return response.choices[0]?.message?.content || "No summary available.";
}
