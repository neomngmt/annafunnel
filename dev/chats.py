"""Write a private HTML page with every saved chat, newest first.

Run from the project folder:
  set -a; . ./.env; set +a; SSL_CERT_FILE=/etc/ssl/cert.pem python3 dev/chats.py [output.html]

The page holds visitors' messages, so keep it on this Mac and never publish it.
"""
import html
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

REF = "eschqmjjmnqllejbcpab"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Desktop/anna-chaty.html")
PRAGUE = ZoneInfo("Europe/Prague")


def query(sql):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        json.dumps({"query": sql}).encode(),
        {"Authorization": "Bearer " + os.environ["SUPABASE_ACCESS_TOKEN"], "Content-Type": "application/json", "User-Agent": "funnel-chats"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


sessions = query("""
  select s.id, s.slug, s.source, s.turns, s.photo_sent, s.link_sent, s.link_clicked, s.blocked, s.created_at
  from funnel_sessions s
  where exists (select 1 from funnel_messages m where m.session_id = s.id and m.role = 'user')
  order by s.created_at desc
""")
messages = query("select session_id, role, content, photo, link, created_at from funnel_messages order by id")
by_session = {}
for m in messages:
    by_session.setdefault(m["session_id"], []).append(m)


def when(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(PRAGUE).strftime("%-d. %-m. %H:%M")


def tag(text, kind):
    return f'<span class="tag {kind}">{text}</span>'


cards = []
for s in sessions:
    tags = [tag(html.escape(s["source"]), "src")]
    if s["photo_sent"]:
        tags.append(tag("fotka", "ok"))
    if s["link_sent"]:
        tags.append(tag("odkaz", "ok"))
    if s["link_clicked"]:
        tags.append(tag("kliknul", "win"))
    if s["blocked"]:
        tags.append(tag("ukončeno", "bad"))
    bubbles = []
    for m in by_session.get(s["id"], []):
        extra = ""
        if m["photo"]:
            extra += '<div class="note">poslala fotku</div>'
        if m["link"]:
            extra += '<div class="note">poslala OF odkaz</div>'
        bubbles.append(f'<div class="msg {m["role"]}">{html.escape(m["content"])}{extra}</div>')
    user_count = sum(1 for m in by_session.get(s["id"], []) if m["role"] == "user")
    cards.append(f"""
<details class="chat" data-src="{html.escape(s['source'])}" data-clicked="{str(s['link_clicked']).lower()}">
  <summary><span class="time">{when(s['created_at'])}</span> {''.join(tags)} <span class="count">{user_count} zpráv</span></summary>
  <div class="log">{''.join(bubbles)}</div>
</details>""")

total = len(sessions)
links = sum(1 for s in sessions if s["link_sent"])
clicks = sum(1 for s in sessions if s["link_clicked"])
sources = sorted({s["source"] for s in sessions})
options = "".join(f'<option value="{html.escape(x)}">{html.escape(x)}</option>' for x in sources)
generated = datetime.now(timezone.utc).astimezone(PRAGUE).strftime("%-d. %-m. %Y %H:%M")

page = f"""<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Anna chaty</title>
<style>
  :root {{ --bg:#0e0d10; --surface:#1a181e; --bubble:#26232c; --accent:#e8467c; --text:#f5f3f7; --muted:#a29eab; --line:#2c2932; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--text); font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }}
  main {{ max-width:720px; margin:0 auto; padding:20px 16px 60px; }}
  h1 {{ font-size:22px; margin:0 0 4px; }}
  .sub {{ color:var(--muted); font-size:13px; margin:0 0 16px; }}
  .stats {{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }}
  .stat {{ background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:10px 14px; min-width:110px; }}
  .stat b {{ display:block; font-size:22px; }}
  .stat span {{ color:var(--muted); font-size:12px; }}
  .filters {{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }}
  select, label {{ background:var(--surface); color:var(--text); border:1px solid var(--line); border-radius:10px; padding:8px 10px; font:inherit; }}
  .chat {{ background:var(--surface); border:1px solid var(--line); border-radius:14px; margin-bottom:10px; }}
  summary {{ cursor:pointer; padding:12px 14px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; list-style:none; }}
  summary::-webkit-details-marker {{ display:none; }}
  .time {{ font-weight:600; }}
  .count {{ margin-left:auto; color:var(--muted); font-size:13px; }}
  .tag {{ font-size:12px; padding:2px 8px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }}
  .tag.ok {{ color:#9ad1ff; border-color:#2d4a63; }}
  .tag.win {{ color:#7ee2a8; border-color:#245a3c; }}
  .tag.bad {{ color:#ff9aa8; border-color:#6a2a35; }}
  .log {{ display:flex; flex-direction:column; gap:6px; padding:4px 14px 14px; }}
  .msg {{ max-width:80%; padding:8px 12px; border-radius:14px; white-space:pre-wrap; overflow-wrap:anywhere; }}
  .msg.assistant {{ align-self:flex-start; background:var(--bubble); border-bottom-left-radius:4px; }}
  .msg.user {{ align-self:flex-end; background:linear-gradient(120deg,#ff5f9e,var(--accent)); color:#fff; border-bottom-right-radius:4px; }}
  .note {{ margin-top:4px; font-size:12px; color:var(--muted); }}
  .empty {{ color:var(--muted); text-align:center; padding:40px 0; }}
</style></head>
<body><main>
  <h1>Anna chaty</h1>
  <p class="sub">Vygenerováno {generated}. Chaty starší než 30 dní se mažou. Obsahuje zprávy návštěvníků, nikam to nesdílej.</p>
  <div class="stats">
    <div class="stat"><b>{total}</b><span>chatů se zprávou</span></div>
    <div class="stat"><b>{links}</b><span>dostalo odkaz</span></div>
    <div class="stat"><b>{clicks}</b><span>kliklo na odkaz</span></div>
  </div>
  <div class="filters">
    <select id="src" aria-label="Zdroj"><option value="">Všechny zdroje</option>{options}</select>
    <label><input type="checkbox" id="clicked"> Jen kdo kliknul</label>
  </div>
  {''.join(cards) or '<p class="empty">Zatím žádné chaty.</p>'}
</main>
<script>
  const apply = () => {{
    const src = document.getElementById("src").value;
    const clicked = document.getElementById("clicked").checked;
    document.querySelectorAll(".chat").forEach((c) => {{
      c.hidden = (src && c.dataset.src !== src) || (clicked && c.dataset.clicked !== "true");
    }});
  }};
  document.getElementById("src").addEventListener("change", apply);
  document.getElementById("clicked").addEventListener("change", apply);
</script>
</body></html>"""

with open(OUT, "w", encoding="utf8") as f:
    f.write(page)
print(f"{total} chats -> {OUT}")
