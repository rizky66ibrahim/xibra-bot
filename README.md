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
| `/news [category]` | 10 latest headlines (clickable), category buttons underneath |
| `/expense 25k lunch` | Record an expense (also `/spending`, `/income`) |
| `/balance` | Cash and bank, investments, this month, budgets |
| `/add` | Add something: asks "Ada jam?" then creates a schedule or a task |
| `/pair CODE` | Link your Xibra account |
| `/cancel` | Stop the current step |
| `/help` | Command list |

Most actions have buttons. When the bot asks a question you can tap an option or type the answer.
Dates accept `besok`, `10-11-2026`, `10 nov`. Amounts accept `25k`, `1,5jt`, `25.000`.

## Accounts

`/balance` then **Tambah akun** asks for the account type first:

- **Tunai**: no name needed, only the amount.
- **Rekening bank**: BCA, SeaBank, Danamon, BRI, BNI, OCBC, or **Bank lain** to type a name.
- **E-wallet**: ShopeePay, OVO, GoPay, DANA, LinkAja, i.Saku, or another name.
- **Investasi / aset**: saham, emas, kripto, reksadana, or other. You enter units and the price per unit.
  The value is units x price. Prices change, so update them with **Perbarui harga**.

To change the bank list, edit `src/features/finance/account-options.ts`.

## Automatic messages

- **Reminders** are delivered every minute (`src/features/reminders/notifier.ts`).
- **06:00 WIB**: morning overview. **18:00 WIB**: asks about a missing transaction or tomorrow's plan, only when something is missing.

## Layout

```
src/
  index.ts              entry point (long polling, command menu, schedulers)
  bot.ts                registers every feature
  core/                 shared code, no feature logic
    config.ts           environment variables
    bridge.ts           calls to the Xibra API bridge
    time.ts             WIB date and time helpers
    money.ts            IDR amounts and units
    ui.ts               icons, day pickers, navigation, message editing
    singleton.ts        refuses to start a second bot process
    wizard/             step-by-step conversations (engine, state, types)
  features/
    home/  tasks/  schedule/  week/  reminders/  shifts/
    news/  finance/  checkin/  add/  pairing/  help/
test/                   all tests, mirroring src/
```

## Setup

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run dev        # local development
npm run build && npm start   # production (see DEPLOY guide)
```

## Notes

- Dates and times are always interpreted on the WIB calendar (Asia/Jakarta).
- Friday shifts are never guessed. The bot asks for the standby count first.
- Only one bot process may poll a Telegram token. For local work, use a separate dev bot token,
  or stop the production service first.
