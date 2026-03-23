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
  const lang = (user.language as AppLanguage) || "UK";

  const welcomeMessages: Record<AppLanguage, string> = {
    UK: "🪞 *Вітаю у WealthMirror AI*\n\n_Твій особистий AI\\-радник з фінансових рішень_\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💬 *Як користуватись:*\n\n📊 /decision — аналіз рішення\n_Приклад: /decision Купити iPhone за 1200€?_\n\n🧠 /profile — твій Financial DNA\n📜 /history — останні рішення\n📈 /week — підсумок тижня\n📊 /usage — ліміт запитів\n🌐 /lang — змінити мову\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🎚 *Режими відповідей:*\n🌿 /mode\\_soft — м\'який\n⚖️ /mode\\_strict — строгий\n🔥 /mode\\_brutal — жорсткий\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n_15 безкоштовних аналізів_ ✨",
    EN: "🪞 *Welcome to WealthMirror AI*\n\n_Your personal AI advisor for financial decisions_\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💬 *How to use:*\n\n📊 /decision — analyze a decision\n_Example: /decision Should I buy iPhone for 1200€?_\n\n🧠 /profile — your Financial DNA\n📜 /history — recent decisions\n📈 /week — weekly summary\n📊 /usage — request limit\n🌐 /lang — change language\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🎚 *Answer modes:*\n🌿 /mode\\_soft — gentle\n⚖️ /mode\\_strict — strict\n🔥 /mode\\_brutal — brutal\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n_15 free analyses_ ✨",
    CS: "🪞 *Vítej ve WealthMirror AI*\n\n_Tvůj osobní AI poradce pro finanční rozhodnutí_\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💬 *Jak používat:*\n\n📊 /decision — analýza rozhodnutí\n_Příklad: /decision Koupit iPhone za 1200€?_\n\n🧠 /profile — tvůj Financial DNA\n📜 /history — poslední rozhodnutí\n📈 /week — týdenní přehled\n📊 /usage — limit dotazů\n🌐 /lang — změnit jazyk\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🎚 *Režimy odpovědí:*\n🌿 /mode\\_soft — jemný\n⚖️ /mode\\_strict — přísný\n🔥 /mode\\_brutal — brutální\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n_15 bezplatných analýz_ ✨"
  };

  await ctx.reply(welcomeMessages[lang], {
    parse_mode: "MarkdownV2",
    ...buildMainKeyboard()
  });
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
  const paidRequests = (user.usage as any)?.paidRequests ?? 0;
  const totalAvailable = freeRequests + paidRequests;
  const left = Math.max(0, totalAvailable - usedRequests);

  const usageMsg = {
    UK: `📊 *Баланс WealthMirror*\n\n🆓 Безкоштовні: ${freeRequests}\n⭐ Платні: ${paidRequests}\n✅ Використано: ${usedRequests}\n🔢 Залишилось: *${left}*\n\n_/buy — поповнити баланс_`,
    EN: `📊 *WealthMirror Balance*\n\n🆓 Free: ${freeRequests}\n⭐ Paid: ${paidRequests}\n✅ Used: ${usedRequests}\n🔢 Left: *${left}*\n\n_/buy — top up balance_`,
    CS: `📊 *WealthMirror Kredit*\n\n🆓 Zdarma: ${freeRequests}\n⭐ Placené: ${paidRequests}\n✅ Použito: ${usedRequests}\n🔢 Zbývá: *${left}*\n\n_/buy — dobít kredit_`
  };
  const lang = (user.language as AppLanguage) || "UK";
  await ctx.reply(usageMsg[lang], { parse_mode: "MarkdownV2" });
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
  const paidRequests = (user.usage as any)?.paidRequests ?? 0;
  const totalAvailable = freeRequests + paidRequests;

  if (usedRequests >= totalAvailable) {
    const buyMsg = {
      UK: "🚫 Ліміт вичерпано\!\n\nПоповни баланс командою /buy\n\n⭐ 50 аналізів — 100 Stars\n💎 200 аналізів — 350 Stars",
      EN: "🚫 Limit reached\!\n\nTop up with /buy\n\n⭐ 50 analyses — 100 Stars\n💎 200 analyses — 350 Stars",
      CS: "🚫 Limit vyčerpán\!\n\nDobij kredit příkazem /buy\n\n⭐ 50 analýz — 100 Stars\n💎 200 analýz — 350 Stars"
    };
    const lang = (user.language as AppLanguage) || "UK";
    await ctx.reply(buyMsg[lang], {
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([[Markup.button.callback("⭐ Купити запити / Buy", "buy_50")]])
    });
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

  const buttonLabels = {
    UK: { history: "📜 Історія", profile: "🧠 Профіль", week: "📈 Тиждень" },
    EN: { history: "📜 History", profile: "🧠 Profile", week: "📈 Week" },
    CS: { history: "📜 Historie", profile: "🧠 Profil", week: "📈 Týden" }
  };
  const bl = buttonLabels[(user.language as AppLanguage) || "UK"];

  await ctx.reply(formatDecisionMessage(result, user.language as AppLanguage), {
    parse_mode: "MarkdownV2",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(bl.history, "goto_history"),
        Markup.button.callback(bl.profile, "goto_profile"),
        Markup.button.callback(bl.week, "goto_week")
      ]
    ])
  });
});

bot.action("goto_history", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("/history");
});
bot.action("goto_profile", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("/profile");
});
bot.action("goto_week", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("/week");
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

  const lines = history.map((item, index: number) => {
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

// ──────────────────────────────────────────
// TELEGRAM STARS PAYMENT
// ──────────────────────────────────────────

const PACKAGES = {
  PACK_50: { stars: 100, requests: 50, label: { UK: "50 аналізів", EN: "50 analyses", CS: "50 analýz" } },
  PACK_200: { stars: 350, requests: 200, label: { UK: "200 аналізів", EN: "200 analyses", CS: "200 analýz" } }
};

bot.command("buy", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const lang = (user.language as AppLanguage) || "UK";

  const titles = {
    UK: "⭐ Поповнити баланс WealthMirror",
    EN: "⭐ Top up WealthMirror balance",
    CS: "⭐ Dobít kredit WealthMirror"
  };

  const descs = {
    UK: "Обери пакет запитів для аналізу фінансових рішень",
    EN: "Choose a package for financial decision analysis",
    CS: "Zvol balíček pro analýzu finančních rozhodnutí"
  };

  const btnLabels = {
    UK: [`🔹 50 аналізів — 100 ⭐`, `💎 200 аналізів — 350 ⭐`],
    EN: [`🔹 50 analyses — 100 ⭐`, `💎 200 analyses — 350 ⭐`],
    CS: [`🔹 50 analýz — 100 ⭐`, `💎 200 analýz — 350 ⭐`]
  };

  await ctx.reply(titles[lang], {
    ...Markup.inlineKeyboard([
      [Markup.button.callback(btnLabels[lang][0], "buy_50")],
      [Markup.button.callback(btnLabels[lang][1], "buy_200")]
    ])
  });
});

bot.action("buy_50", async (ctx) => {
  await ctx.answerCbQuery();
  const user = await getOrCreateUser(ctx);
  const lang = (user.language as AppLanguage) || "UK";

  const titles = { UK: "50 аналізів WealthMirror", EN: "50 WealthMirror analyses", CS: "50 WealthMirror analýz" };
  const descs = { UK: "Поповнення на 50 фінансових аналізів", EN: "Top up with 50 financial analyses", CS: "Dobití 50 finančních analýz" };

  await ctx.telegram.sendInvoice(ctx.chat!.id, {
    title: titles[lang],
    description: descs[lang],
    payload: "PACK_50",
    provider_token: "",
    currency: "XTR",
    prices: [{ label: titles[lang], amount: 100 }]
  });
});

bot.action("buy_200", async (ctx) => {
  await ctx.answerCbQuery();
  const user = await getOrCreateUser(ctx);
  const lang = (user.language as AppLanguage) || "UK";

  const titles = { UK: "200 аналізів WealthMirror", EN: "200 WealthMirror analyses", CS: "200 WealthMirror analýz" };
  const descs = { UK: "Поповнення на 200 фінансових аналізів", EN: "Top up with 200 financial analyses", CS: "Dobití 200 finančních analýz" };

  await ctx.telegram.sendInvoice(ctx.chat!.id, {
    title: titles[lang],
    description: descs[lang],
    payload: "PACK_200",
    provider_token: "",
    currency: "XTR",
    prices: [{ label: titles[lang], amount: 350 }]
  });
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message", async (ctx: any) => {
  if (!ctx.message?.successful_payment) return;

  const payment = ctx.message.successful_payment;
  const payload = payment.invoice_payload as keyof typeof PACKAGES;
  const pkg = PACKAGES[payload];

  if (!pkg) return;

  const user = await getOrCreateUser(ctx);

  await prisma.usage.update({
    where: { userId: user.id },
    data: { paidRequests: { increment: pkg.requests } }
  });

  const lang = (user.language as AppLanguage) || "UK";
  const successMsg = {
    UK: `✅ Оплата успішна\! Додано *${pkg.requests} аналізів* до твого балансу\.\n\n⭐ Зірки отримані: *${payment.total_amount}*`,
    EN: `✅ Payment successful\! Added *${pkg.requests} analyses* to your balance\.\n\n⭐ Stars received: *${payment.total_amount}*`,
    CS: `✅ Platba úspěšná\! Přidáno *${pkg.requests} analýz* na váš kredit\.\n\n⭐ Přijaté Stars: *${payment.total_amount}*`
  };

  await ctx.reply(successMsg[lang], { parse_mode: "MarkdownV2" });
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
