import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getOptionalEnv(name: string, fallback = ""): string {
  return (process.env[name] || fallback).trim();
}

const nodeEnv = getOptionalEnv("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

export const config = {
  nodeEnv,
  isProduction,
  port: Number(getOptionalEnv("PORT", "3000")),
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  databaseUrl: requireEnv("DATABASE_URL"),
  directUrl: getOptionalEnv("DIRECT_URL"),
  appBaseUrl: isProduction
    ? requireEnv("APP_BASE_URL")
    : getOptionalEnv("APP_BASE_URL", "http://localhost:3000"),
  webhookSecret: isProduction
    ? requireEnv("WEBHOOK_SECRET")
    : getOptionalEnv("WEBHOOK_SECRET", "local-dev-secret")
};

if (Number.isNaN(config.port) || config.port <= 0) {
  throw new Error("PORT must be a valid positive number");
}

if (config.isProduction && !config.appBaseUrl.startsWith("https://")) {
  throw new Error("APP_BASE_URL must start with https:// in production");
}
