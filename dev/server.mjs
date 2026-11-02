// Local preview. With ANTHROPIC_API_KEY in .env the bot is real Claude using the
// persona from sql/pages/anna.sql. Without it, it plays fixed lines and says so on the page.
// Run: node --env-file-if-exists=.env dev/server.mjs, then open http://localhost:4321/?m=anna&src=ig
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { handleRequest, modelRequest, readModelResponse } from "../supabase/functions/funnel-chat/core.ts";
import { fakeDeps } from "./fake.mjs";

// The values of the insert, one quoted string per line, in column order.
const sql = readFileSync(new URL("../sql/pages/anna.sql", import.meta.url), "utf8");
const [slug, name, language, opener, photoUrl, teasePhotos, persona, style, offer, ofLinks] =
  [...sql.matchAll(/^\s*'(.*)',?$/gm)].map((m) => m[1]);
const PAGE = { slug, name, language, opener, photoUrl, teasePhotos: JSON.parse(teasePhotos), persona, style, offer, ofLinks: JSON.parse(ofLinks) };

const SCRIPT = [
  { reply: "to znělo skoro přesvědčivě. jsi takhle odvážnej i normálně, nebo jen přes mobil?", action: "continue" },
  { reply: "kočka by tě asi neschválila, já ještě přemýšlím. co děláš, když zrovna nikoho neokouzluješ?", action: "continue" },
  { reply: "mám přes 50 tetování, kolik myslíš že jich uvidíš?", action: "continue" },
  { reply: "to je odvážnej tip. máš nějaký sám, nebo se bojíš jehly?", action: "continue" },
  { reply: "hm, začínáš mě bavit. jsi dneska hodnej, nebo zlobíš?", action: "continue" },
  { reply: "tak tohle je jen ochutnávka", follow_up: "píšu si s lidma hlavně jen na of, tak přijď", interested: true, action: "send_link" },
  { reply: "cestu už znáš. co dalšího umíš?", action: "continue" },
];
const turns = new Map();
function scripted(_system, messages) {
  const key = JSON.stringify(messages[0]);
  const n = turns.get(key) || 0;
  turns.set(key, n + 1);
  return SCRIPT[Math.min(n, SCRIPT.length - 1)];
}

const live = !!process.env.ANTHROPIC_API_KEY;
let callModel = async (system, messages) => scripted(system, messages);
if (live) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  callModel = async (system, messages) =>
    readModelResponse(await client.beta.messages.create(modelRequest(system, messages, process.env.FUNNEL_MODEL || undefined)));
}
const deps = fakeDeps(callModel, PAGE);

const BANNER = `<div style="background:#b45309;color:#fff;font:13px sans-serif;padding:6px 12px;text-align:center">Náhled: připravené věty, bot nečte, co píšeš. Pravé odpovědi až s API klíčem v .env.</div>`;

const PORT = Number(process.env.PORT) || 4321;
createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (!live) await new Promise((r) => setTimeout(r, 500));
    try {
      const { status, body } = await handleRequest(JSON.parse(raw), req.socket.remoteAddress, deps);
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    } catch (e) {
      console.error(e);
      res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Chat is unavailable" }));
    }
    return;
  }
  if (req.url === "/") {
    res.writeHead(302, { Location: "/?m=anna&src=ig" }).end();
    return;
  }
  const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const html = page.replace(/(name="funnel-api" content=")[^"]*/, "$1/api");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(live ? html : html.replace('<div class="app">', `<div class="app">${BANNER}`));
}).listen(PORT, () => console.log(`${live ? "real Claude" : "scripted bot"}: http://localhost:${PORT}/?m=anna&src=ig`));
