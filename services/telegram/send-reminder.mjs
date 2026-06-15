import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const streamId = process.env.STREAM_ID || process.argv[2] || "esp-cpv";
const streamUrl = process.env.YOUTUBE_STREAM_URL || "YOUTUBE_STREAM_URL_NOT_SET";
const dryRun = process.env.TELEGRAM_DRY_RUN !== "false";
const root = resolve(new URL("../..", import.meta.url).pathname);
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");

function reminder(stream) {
  return [
    `Live soon: ${stream.home} vs ${stream.away}`,
    "",
    `Kickoff: ${stream.kickoffIst}`,
    "Format: English no-footage watchalong",
    "",
    "What you get:",
    "- live score and timer",
    "- English AI commentary prompts",
    "- match pulse and chat polls",
    "- no match footage and no broadcast audio",
    "",
    `Watch here: ${streamUrl}`,
    "",
    "Drop your country and score prediction in chat before kickoff."
  ].join("\n");
}

async function sendTelegram(text) {
  if (!botToken || !chatId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload;
}

const streams = JSON.parse(await readFile(streamsPath, "utf8"));
const stream = streams.find((item) => item.id === streamId);

if (!stream) {
  console.error(`Unknown stream id: ${streamId}`);
  process.exit(1);
}

const text = reminder(stream);

if (dryRun) {
  console.log("Dry run only. Set TELEGRAM_DRY_RUN=false and required env vars to send.");
  console.log("\n--- Telegram Message ---\n");
  console.log(text);
  process.exit(0);
}

try {
  const result = await sendTelegram(text);
  console.log(JSON.stringify({
    ok: true,
    message_id: result.result?.message_id,
    chat_id: result.result?.chat?.id
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
