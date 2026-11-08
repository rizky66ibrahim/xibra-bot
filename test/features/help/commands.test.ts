import { test } from "node:test";
import assert from "node:assert/strict";
import { BOT_COMMANDS, toBotFatherText } from "../../../src/features/help/commands.js";

test("every command name is valid for Telegram", () => {
  for (const c of BOT_COMMANDS) {
    assert.match(c.command, /^[a-z0-9_]{1,32}$/, c.command);
  }
});

test("every description has the length Telegram accepts (3 to 256)", () => {
  for (const c of BOT_COMMANDS) {
    assert.ok(c.description.length >= 3 && c.description.length <= 256, c.command);
  }
});

test("no command is listed twice", () => {
  const names = BOT_COMMANDS.map((c) => c.command);
  assert.equal(new Set(names).size, names.length);
});

test("the feature commands exist", () => {
  const names = BOT_COMMANDS.map((c) => c.command);
  for (const expected of ["start", "task", "schedule", "week", "reminder", "shift", "news", "weather", "balance", "expense", "add", "help"]) {
    assert.ok(names.includes(expected), expected);
  }
});

test("the BotFather text is one 'command - description' line per command", () => {
  const lines = toBotFatherText().split("\n");
  assert.equal(lines.length, BOT_COMMANDS.length);
  assert.equal(lines[0], "start - Ringkasan hari ini");
  assert.ok(lines.every((line) => /^[a-z0-9_]+ - .+/.test(line)));
});
