import { Context, Markup, Telegraf } from "telegraf";
import { prisma } from "./db";
import { config } from "./config";
import { analyzeDecision, buildProfile, buildWeeklySummary } from "./ai";
import { AppLanguage, BotMode } from "./types";
import { escapeMarkdownV2 } from "./utils/escapeMarkdown";
import { formatDecisionMessage, getText } from "./utils/format";

type BotContext = Context;

export const bot = new Telegraf<BotContext>(config.telegramBotToken);

function buildMainKeyboard() {
  return Markup.keyboard([
    ["/decision", "/profile"],
    ["/history", "/week"],
    ["/usage", "/lang"],
    ["/mode_soft", "/mode_strict", "/mode_brutal"]
  ]).resize();
}

async function getOrCreateUser(ctx: Context) {
  if (!ctx.from) {
    throw new Error("Telegram user info is missing in context");
  }

  const telegramId = String(ctx.from.id);

  let user = await prisma.user.findUnique({
    where: { telegramId },
    include: { usage: true }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: ctx.from.username || null,
        firstName: ctx.from.first_name || null,
        usage: {
          create: {
            freeRequests: 15,
            usedRequests: 0
          }
        }
      },
      include: { usage: true }
    });
  }

  return user;
}

bot.start(async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  await ctx.reply(
    `👋 ${t.welcome}\n\n${t.subtitle}\n\n${t.commands}:\n` +
      `/decision ...\n/profile\n/history\n/week\n/usage\n/lang\n/mode_soft\n/mode_strict\n/mode_brutal`,
    buildMainKeyboard()
  );
});

bot.command("lang", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  await ctx.reply(
    t.chooseLanguage,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🇺🇦 Українська", "lang_UK"),
        Markup.button.callback("🇬🇧 English", "lang_EN"),
        Markup.button.callback("🇨🇿 Čeština", "lang_CS")
      ]
    ])
  );
});

bot.action(/^lang_(EN|UK|CS)$/, async (ctx) => {
  if (!ctx.from) return;

  const selected = (ctx.match as RegExpExecArray)[1] as AppLanguage;
  const user = await getOrCreateUser(ctx);

  await prisma.user.update({
    where: { id: user.id },
    data: { language: selected }
  });

  const t = getText(selected);

  await ctx.answerCbQuery();
  await ctx.reply(`✅ ${t.languageChanged}`, buildMainKeyboard());
});

bot.command("usage", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  const freeRequests = user.usage?.freeRequests ?? 15;
  const usedRequests = user.usage?.usedRequests ?? 0;
  const left = Math.max(0, freeRequests - usedRequests);

  await ctx.reply(`📊 ${t.usage}\n\nUsed: ${usedRequests}/${freeRequests}\nLeft: ${left}`);
});

bot.command("mode_soft", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  await prisma.user.update({
    where: { id: user.id },
    data: { mode: "SOFT" }
  });

  await ctx.reply(`✅ ${t.modeChangedSoft}`);
});

bot.command("mode_strict", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  await prisma.user.update({
    where: { id: user.id },
    data: { mode: "STRICT" }
  });

  await ctx.reply(`✅ ${t.modeChangedStrict}`);
});

bot.command("mode_brutal", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  await prisma.user.update({
    where: { id: user.id },
    data: { mode: "BRUTAL" }
  });

  await ctx.reply(`✅ ${t.modeChangedBrutal}`);
});

bot.command("decision", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);
  const messageText = ctx.message && "text" in ctx.message
    ? ctx.message.text.replace(/^\/decision(@\w+)?/, "").trim()
    : "";

  if (!messageText) {
    await ctx.reply(t.noTextDecision);
    return;
  }

  const freeRequests = user.usage?.freeRequests ?? 15;
  const usedRequests = user.usage?.usedRequests ?? 0;

  if (usedRequests >= freeRequests) {
    await ctx.reply(`🚫 ${t.limitReached}`);
    return;
  }

  await ctx.reply(`⏳ ${t.analyzing}`);

  const history = await prisma.decision.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const memorySummary = history.length
    ? history
        .map(
          (d) =>
            `Decision: ${d.text} | Verdict: ${d.aiVerdict} | Risk: ${d.riskLevel} | Category: ${d.category}`
        )
        .join("\n")
    : "";

  const result = await analyzeDecision({
    text: messageText,
    mode: user.mode as BotMode,
    memorySummary,
    language: user.language as AppLanguage
  });

  await prisma.$transaction([
    prisma.decision.create({
      data: {
        userId: user.id,
        text: messageText,
        amount: result.estimatedAmount ?? null,
        category: result.category,
        urgency: result.urgency,
        aiVerdict: result.verdict,
        aiReasoning: result.reasoning,
        riskLevel: result.riskLevel,
        behaviorSignal: result.behaviorSignal
      }
    }),
    prisma.usage.update({
      where: { userId: user.id },
      data: {
        usedRequests: { increment: 1 }
      }
    })
  ]);

  await ctx.reply(formatDecisionMessage(result, user.language as AppLanguage), {
    parse_mode: "MarkdownV2"
  });
});

bot.command("profile", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  const history = await prisma.decision.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  if (!history.length) {
    await ctx.reply(`🧠 ${t.profileEmpty}`);
    return;
  }

  const historyText = history
    .map(
      (d) =>
        `Text: ${d.text}; Verdict: ${d.aiVerdict}; Risk: ${d.riskLevel}; Category: ${d.category}; Signal: ${d.behaviorSignal || ""}`
    )
    .join("\n");

  const profile = await buildProfile({
    history: historyText,
    language: user.language as AppLanguage
  });

  await prisma.insight.create({
    data: {
      userId: user.id,
      title: "Financial DNA Profile",
      content: profile
    }
  });

  await ctx.reply(`🧠 *${escapeMarkdownV2(t.profileTitle)}*\n\n${escapeMarkdownV2(profile)}`, {
    parse_mode: "MarkdownV2"
  });
});

bot.command("history", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  const history = await prisma.decision.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 7
  });

  if (!history.length) {
    await ctx.reply(`📭 ${t.historyEmpty}`);
    return;
  }

  const lines = history.map((item, index) => {
    const category = item.category || "General";
    return `${index + 1}. ${item.aiVerdict} | ${item.riskLevel} | ${category}\n${item.text}`;
  });

  await ctx.reply(`📜 ${t.historyTitle}\n\n${lines.join("\n\n")}`);
});

bot.command("week", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);

  const history = await prisma.decision.findMany({
    where: {
      userId: user.id,
      createdAt: {
        gte: fromDate
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!history.length) {
    await ctx.reply(`📭 ${t.historyEmpty}`);
    return;
  }

  const historyText = history
    .map(
      (d) =>
        `Text: ${d.text}; Verdict: ${d.aiVerdict}; Risk: ${d.riskLevel}; Category: ${d.category}; Signal: ${d.behaviorSignal || ""}`
    )
    .join("\n");

  const summary = await buildWeeklySummary({
    history: historyText,
    language: user.language as AppLanguage
  });

  await ctx.reply(`📈 *${escapeMarkdownV2(t.weekTitle)}*\n\n${escapeMarkdownV2(summary)}`, {
    parse_mode: "MarkdownV2"
  });
});

bot.on("text", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const t = getText(user.language as AppLanguage);
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) {
    return;
  }

  await ctx.reply(t.fallback, buildMainKeyboard());
});

bot.catch(async (error, ctx) => {
  console.error("Bot error:", error);
  try {
    const user = ctx.from ? await getOrCreateUser(ctx) : null;
    const language = (user?.language as AppLanguage | undefined) || "EN";
    const t = getText(language);
    await ctx.reply(`❌ ${t.unknownError}`);
  } catch (nestedError) {
    console.error("Failed to send error message:", nestedError);
  }
});
