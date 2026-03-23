import express from "express";
import { bot } from "./bot";
import { config } from "./config";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "wealthmirror-ai",
    mode: config.isProduction ? "webhook" : "polling"
  });
});

app.get("/", (_req, res) => {
  res.status(200).send("WealthMirror AI is running.");
});

async function start() {
  if (config.isProduction) {
    const webhookPath = `/telegram/webhook/${config.webhookSecret}`;

    app.use(bot.webhookCallback(webhookPath));

    await bot.telegram.setWebhook(`${config.appBaseUrl}${webhookPath}`);

    console.log("✅ Webhook mode enabled");
    console.log(`✅ Webhook URL: ${config.appBaseUrl}${webhookPath}`);
  } else {
    await bot.launch();
    console.log("✅ Polling mode enabled");
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${config.port}`);
  });
}

start().catch((error) => {
  console.error("❌ Failed to start application:", error);
  process.exit(1);
});

process.once("SIGINT", async () => {
  try {
    await bot.stop("SIGINT");
  } finally {
    process.exit(0);
  }
});

process.once("SIGTERM", async () => {
  try {
    await bot.stop("SIGTERM");
  } finally {
    process.exit(0);
  }
});
