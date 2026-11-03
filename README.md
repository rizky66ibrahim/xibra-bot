# Xibra Bot

Telegram front end for Xibra Platform. Every feature lives in its own folder under `src/features/`, and every test lives under `test/`, mirroring `src/`.

## Commands

| Command | What it does |
| --- | --- |
| `/start` | Today's overview with buttons |
| `/task` | Open tasks, tap a button to finish one |
| `/schedule [date]` | Schedule of one day, with previous and next buttons |
| `/week [date]` | Next 7 days: shifts, schedule, reminders |
| `/reminder` | Upcoming reminders |
| `/shift [date]` | Shift of one day, plus Log shift and Night block buttons |
| `/news [category]` | Latest headlines |
| `/add` | Add a task, schedule, or reminder |
| `/pair CODE` | Link your Xibra account |
| `/cancel` | Stop the current step |
| `/help` | Command list |

Most actions have buttons. When the bot asks a question you can tap an option or type the answer. Dates accept `besok`, `10-11-2026`, `10 nov`, and similar.

## Layout

```
src/
  index.ts              entry point (long polling, command menu)
  bot.ts                registers every feature
  core/                 shared code, no feature logic
    config.ts           environment variables
    bridge.ts           calls to the Xibra API bridge
    time.ts             WIB date and time helpers
    ui.ts               icons, day pickers, navigation buttons
    wizard/             step-by-step conversations (engine, state, types)
  features/
    home/               /start
    tasks/              /task, done buttons, add-task wizard
    schedule/           /schedule, add-schedule wizard
    week/               /week
    reminders/          /reminder, add-reminder wizard
    shifts/             /shift, log shift, night block, Friday standby
    news/               /news (feeds, RSS parser, cache, handler)
    add/                /add chooser
    pairing/            /pair
    help/               /help
test/                   all tests, mirroring src/
  core/
  features/
```

## Setup

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run dev
```

## Notes

- Dates and times are always interpreted on the WIB calendar (Asia/Jakarta).
- Friday shifts are never guessed. The bot asks for the standby count first.
- Night block planning sends the start date to the API, which computes the rotation.
