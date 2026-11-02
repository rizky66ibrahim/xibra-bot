# Xibra Bot

Telegram bot for **Xibra Platform**. It connects a Telegram account to a Xibra user, shows news by category, and will become the Telegram front end for tasks, finance, and email summaries.

- Bot username: **@xibra_bot**
- Backend: **Xibra API** (`xibra-api`, Laravel)

> Status: v0.2. Pairing and news wizard work. Tasks, finance, and email are planned.

## Two bots, two purposes

| Bot | Name | Username | Purpose | Managed in |
| --- | --- | --- | --- | --- |
| Hermes | Xibra-Platform | @XibraPlatformBot | Personal AI assistant on the VPS | Hermes gateway (not in this repo) |
| Xibra Bot | Xibra-Bot | @xibra_bot | Pairing, news, and Xibra commands | This repository |

Each bot has its own token. Hermes is not changed by this repository.

## Features

### Pairing
- `/pair XIBRA-XXXX-XXXX` links the Telegram account to a Xibra user.
- The code comes from the Xibra dashboard, is single-use, and expires after 5 minutes.
- The bot holds only the bot secret, never a user token.

### News wizard
- `/berita` starts a two-step wizard: pick a category, then pick how many items to show.
- `/berita teknologi` skips the first step.
- Each category merges several RSS or Atom sources, removes duplicates, and sorts by newest first.
- Results are cached for 10 minutes. If every source fails, the last cached result is shown and marked as stale.
- Each source has backup URLs. A failed source is listed in the message, and the rest still show.
- The **Refresh** button reloads a category without restarting the wizard.

### Wizard engine
- Multi-step conversations use inline buttons (choice steps) and typed replies (text steps).
- Each step accepts only the answer it expects. Stale buttons show "session expired" instead of doing something unexpected.
- `/batal` or the Cancel button stops any running flow.
- Sessions are kept in memory and expire after 10 minutes of inactivity.

## Commands

| Command | What it does |
| --- | --- |
| `/start`, `/menu` | Main menu |
| `/berita [kategori]` | News wizard, optionally with a category |
| `/pair <kode>` | Link this Telegram account to Xibra |
| `/batal` | Cancel the current flow |
| `/help` | Command list |

Categories: `indonesia`, `ekonomi`, `teknologi`. Aliases such as `tekno`, `saham`, or `nasional` also work.

## Planned features

| Feature | Depends on | Phase |
| --- | --- | --- |
| Tasks: `/todo`, `/addtask`, `/done` | Xibra API endpoints for bot calls | 3 |
| Finance: quick expense entry, daily summary | Xibra API finance endpoints | 5 |
| Email summary (Gmail) | Gmail OAuth with tokens stored encrypted in Xibra API | after API auth bridge |
| Daily digest and reminders | Scheduler on the VPS | 4 |

### Why the bot does not own business data

The bot does not write to its own database. Tasks, finance, and email data belong to Xibra API, following the rule that AI and bot components access business data only through an authenticated API. Gmail refresh tokens are stored in Xibra API, encrypted, and never in the bot.

## Requirements

- Node.js 20 or newer
- A bot token from @BotFather for @xibra_bot
- Xibra API running, with `TELEGRAM_BOT_SECRET` set in its `.env`

## Setup

```bash
git clone https://github.com/rizky66ibrahim/xibra-bot.git
cd xibra-bot
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Value |
| --- | --- |
| `BOT_TOKEN` | Token of @xibra_bot from @BotFather |
| `XIBRA_API_BASE` | `http://localhost:8000` for local development |
| `TELEGRAM_BOT_SECRET` | The same value as `TELEGRAM_BOT_SECRET` in the Xibra API `.env` |

Then run:

```bash
npm run dev
```

You should see `Xibra Bot running as @xibra_bot`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run with auto-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled bot |
| `npm test` | Run unit tests (RSS parser and wizard engine) |
| `npm run typecheck` | Check types without emitting files |

## Project structure

```
src/
  index.ts              Entry point, long polling
  bot.ts                Command and callback wiring
  api.ts                Client for the Xibra API pairing endpoint
  config.ts             Environment variables
  handlers/
    menu.ts             Main menu and help text
    news.ts             News wizard flow and refresh
  news/
    feeds.ts            Categories and RSS sources
    rss.ts              RSS and Atom parser, dedupe
    service.ts          Fetching, fallback URLs, cache
    format.ts           Relative time in Indonesian
  wizard/
    types.ts            Flow and step types
    engine.ts           Step runner (choice and text)
    state.ts            In-memory sessions with expiry
```

## Security notes

- `BOT_TOKEN` and `TELEGRAM_BOT_SECRET` are secrets. Keep them in `.env` only. `.env` is ignored by Git.
- Pairing codes are never written to logs.
- If `TELEGRAM_BOT_SECRET` leaks, change it in both the API `.env` and this bot's `.env`, then restart both.
- If `BOT_TOKEN` leaks, revoke it in @BotFather with `/revoke` and update `.env`.

## Deployment (planned)

Development uses long polling. On the VPS, the bot will run as a `systemd` service with a webhook behind Nginx, following the same flow as the Xibra API: local development, commit, push to GitHub, pull on the VPS, verify in production.

## License

Private project.
