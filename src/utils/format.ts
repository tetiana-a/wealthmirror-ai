import { AppLanguage, DecisionAIResult } from "../types";
import { escapeMarkdownV2 } from "./escapeMarkdown";

export function getText(language: AppLanguage) {
  const texts = {
    EN: {
      welcome: "Welcome to WealthMirror AI",
      subtitle: "AI bot for financial decisions, spending behavior, and personal money patterns.",
      chooseLanguage: "Choose language:",
      commands: "Commands",
      analysisTitle: "WealthMirror Analysis",
      verdict: "Verdict",
      risk: "Risk",
      category: "Category",
      urgency: "Urgency",
      why: "Why",
      behavior: "Behavior signal",
      advice: "Advice",
      noAdvice: "No advice available.",
      noSignal: "No behavior signal.",
      noTextDecision: "Write text after the command.\\nExample:\\n/decision Should I buy an iPhone for 1200€?",
      analyzing: "Analyzing your financial decision...",
      limitReached: "Free limit reached. Upgrade to Pro.",
      profileEmpty: "Not enough history yet for a Financial DNA profile.",
      profileTitle: "Your Financial DNA",
      historyEmpty: "No history yet.",
      usage: "Usage",
      modeChangedSoft: "Mode changed to SOFT.",
      modeChangedStrict: "Mode changed to STRICT.",
      modeChangedBrutal: "Mode changed to BRUTAL.",
      languageChanged: "Language updated.",
      fallback: "Use:\\n/decision Should I buy this for 300€?\\n/profile\\n/history\\n/week",
      weekTitle: "7-day summary",
      historyTitle: "Recent decisions",
      unknownError: "Something went wrong. Please try again."
    },
    UK: {
      welcome: "Вітаю в WealthMirror AI",
      subtitle: "AI-бот для фінансових рішень, поведінки витрат і персональних грошових патернів.",
      chooseLanguage: "Оберіть мову:",
      commands: "Команди",
      analysisTitle: "Аналіз WealthMirror",
      verdict: "Вердикт",
      risk: "Ризик",
      category: "Категорія",
      urgency: "Терміновість",
      why: "Чому",
      behavior: "Поведінковий сигнал",
      advice: "Поради",
      noAdvice: "Поради відсутні.",
      noSignal: "Немає сигналу поведінки.",
      noTextDecision: "Напиши текст після команди.\\nПриклад:\\n/decision Чи варто купити iPhone за 1200€?",
      analyzing: "Аналізую твоє фінансове рішення...",
      limitReached: "Безкоштовний ліміт вичерпано. Перейди на Pro.",
      profileEmpty: "Ще недостатньо історії для профілю Financial DNA.",
      profileTitle: "Твій Financial DNA",
      historyEmpty: "Історії ще немає.",
      usage: "Використання",
      modeChangedSoft: "Режим змінено на SOFT.",
      modeChangedStrict: "Режим змінено на STRICT.",
      modeChangedBrutal: "Режим змінено на BRUTAL.",
      languageChanged: "Мову оновлено.",
      fallback: "Використай:\\n/decision Чи купити це за 300€?\\n/profile\\n/history\\n/week",
      weekTitle: "Підсумок за 7 днів",
      historyTitle: "Останні рішення",
      unknownError: "Сталася помилка. Спробуй ще раз."
    },
    CS: {
      welcome: "Vítej ve WealthMirror AI",
      subtitle: "AI bot pro finanční rozhodnutí, chování při utrácení a osobní finanční vzorce.",
      chooseLanguage: "Zvolte jazyk:",
      commands: "Příkazy",
      analysisTitle: "WealthMirror Analýza",
      verdict: "Verdikt",
      risk: "Riziko",
      category: "Kategorie",
      urgency: "Naléhavost",
      why: "Proč",
      behavior: "Behaviorální signál",
      advice: "Doporučení",
      noAdvice: "Žádné doporučení.",
      noSignal: "Žádný behaviorální signál.",
      noTextDecision: "Napište text za příkaz.\\nPříklad:\\n/decision Mám koupit iPhone za 1200€?",
      analyzing: "Analyzuji vaše finanční rozhodnutí...",
      limitReached: "Bezplatný limit byl vyčerpán. Přejděte na Pro.",
      profileEmpty: "Zatím není dost historie pro profil Financial DNA.",
      profileTitle: "Vaše Financial DNA",
      historyEmpty: "Zatím žádná historie.",
      usage: "Využití",
      modeChangedSoft: "Režim změněn na SOFT.",
      modeChangedStrict: "Režim změněn na STRICT.",
      modeChangedBrutal: "Režim změněn na BRUTAL.",
      languageChanged: "Jazyk byl aktualizován.",
      fallback: "Použijte:\\n/decision Mám to koupit za 300€?\\n/profile\\n/history\\n/week",
      weekTitle: "Souhrn za 7 dní",
      historyTitle: "Poslední rozhodnutí",
      unknownError: "Došlo k chybě. Zkuste to znovu."
    }
  };

  return texts[language];
}

function getVerdictEmoji(verdict: string): string {
  const v = verdict.toUpperCase();
  if (v === "BUY" || v === "YES" || v === "GO") return "✅";
  if (v === "WAIT" || v === "MAYBE") return "⏳";
  if (v === "NO" || v === "SKIP" || v === "STOP") return "🚫";
  return "🔍";
}

function getRiskEmoji(risk: string): string {
  const r = risk.toUpperCase();
  if (r === "LOW") return "🟢";
  if (r === "MEDIUM") return "🟡";
  if (r === "HIGH") return "🔴";
  return "⚪";
}

export function formatDecisionMessage(data: DecisionAIResult, language: AppLanguage): string {
  const t = getText(language);

  const verdictEmoji = getVerdictEmoji(data.verdict);
  const riskEmoji = getRiskEmoji(data.riskLevel);

  const adviceLines = (data.advice || [])
    .slice(0, 3)
    .map((item, i) => {
      const icons = ["💡", "📌", "🎯"];
      return `${icons[i]} ${escapeMarkdownV2(item)}`;
    })
    .join("\n");

  return [
    `🪞 *${escapeMarkdownV2(t.analysisTitle)}*`,
    `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`,
    "",
    `${verdictEmoji} *${escapeMarkdownV2(t.verdict)}:* \`${escapeMarkdownV2(data.verdict)}\``,
    `${riskEmoji} *${escapeMarkdownV2(t.risk)}:* \`${escapeMarkdownV2(data.riskLevel)}\``,
    `📂 *${escapeMarkdownV2(t.category)}:* ${escapeMarkdownV2(data.category || "General")}`,
    `⚡ *${escapeMarkdownV2(t.urgency)}:* ${escapeMarkdownV2(data.urgency || "MEDIUM")}`,
    "",
    `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`,
    `🧠 *${escapeMarkdownV2(t.why)}*`,
    `${escapeMarkdownV2(data.reasoning || "")}`,
    "",
    `🔬 *${escapeMarkdownV2(t.behavior)}*`,
    `${escapeMarkdownV2(data.behaviorSignal || t.noSignal)}`,
    "",
    `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`,
    `📋 *${escapeMarkdownV2(t.advice)}*`,
    adviceLines || escapeMarkdownV2(t.noAdvice),
    "",
    `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`,
    `_WealthMirror AI_`
  ].join("\n");
}
 
