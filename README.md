# WealthMirror AI v3

Production-ready Telegram AI bot for financial decision analysis.

## Features

- /decision — analyze a spending decision
- /profile — Financial DNA profile
- /history — recent decisions
- /week — weekly summary
- /usage — usage counter
- /lang — EN / UK / CS
- /mode_soft, /mode_strict, /mode_brutal — answer tone
- Local dev with polling
- Production deploy with Telegram webhook

## Stack

- Node.js
- TypeScript
- Telegraf
- PostgreSQL / Supabase
- Prisma
- OpenAI API
- Express

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Render build command

```bash
npm install && npm run prisma:generate && npm run build
```

## Render start command

```bash
npm run prisma:deploy && npm run start
```

## Render env vars

```env
NODE_ENV=production
PORT=10000
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
DATABASE_URL=YOUR_SUPABASE_POOLED_URL
DIRECT_URL=YOUR_SUPABASE_DIRECT_URL
APP_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
WEBHOOK_SECRET=YOUR_LONG_RANDOM_SECRET
```
