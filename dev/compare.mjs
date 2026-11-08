// Same chats through several model and effort settings, to compare the Czech.
// Run: set -a; . ./.env; set +a; node dev/compare.mjs
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, modelRequest, readModelResponse } from "../supabase/functions/funnel-chat/core.ts";

const REF = "eschqmjjmnqllejbcpab";
const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: "select * from funnel_pages where slug = 'anna'" }),
});
const [row] = await resp.json();
const page = {
  slug: row.slug, name: row.model_name, language: row.language, opener: row.opener, photoUrl: row.photo_url,
  teasePhotos: row.tease_photos || [], persona: row.persona || "", style: row.style || "", offer: row.offer || "", ofLinks: row.of_links || {},
};

const FIRST = "ahaaa tak jo, a copak teď děláš?";
const CHATS = [
  ["z instace", "koukam na tv"],
  ["z instace", "jsem v praci"],
  ["z reels", "nic moc, nudim se doma"],
];
const VARIANTS = [["claude-sonnet-5-5", "low"], ["claude-opus-5-5", "low"]];

const client = new Anthropic({ timeout: 40000, maxRetries: 1 });
for (const [model, effort] of VARIANTS) {
  console.log(`\n=== ${model} ${effort}`);
  for (const [a, b] of CHATS) {
    const messages = [{ role: "user", content: a }, { role: "assistant", content: FIRST }, { role: "user", content: b }];
    const request = modelRequest(buildSystemPrompt(page, 2, false), messages, model);
    request.output_config.effort = effort;
    const started = Date.now();
    const answer = readModelResponse(await client.beta.messages.create(request));
    console.log(`${b} -> ${answer?.reply} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }
}
