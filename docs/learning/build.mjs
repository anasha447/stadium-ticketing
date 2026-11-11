// Builds docs/learning/index.html from lessons/*.md + LEARNING-NOTES.md.
// No dependencies: run with `node docs/learning/build.mjs` from anywhere.
// The output is one self-contained page — open it by double-clicking.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lessonsDir = join(here, "lessons");

// ── Markdown → HTML (the subset our lessons use) ───────────────────────────
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[`*_]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inline(text) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
       .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
       .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>")
       .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}

const isListLine = (l) => /^\s*([-*]|\d+\.)\s+/.test(l);
const isRawHtml = (l) => /^\s*<\/?(details|summary|div|span|kbd|br)\b/i.test(l);

function renderList(lines) {
  // lines: list lines + indented continuations; builds nested lists by indent
  const items = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (m) items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3], sub: [] });
    else if (items.length) items[items.length - 1].text += " " + line.trim();
  }
  const build = (list, start, indent) => {
    let html = "", i = start;
    const ordered = list[start]?.ordered;
    html += ordered ? "<ol>" : "<ul>";
    while (i < list.length && list[i].indent >= indent) {
      if (list[i].indent > indent) { const [h, j] = build(list, i, list[i].indent); html = html.replace(/<\/li>$/, h + "</li>"); i = j; continue; }
      const box = list[i].text.match(/^\[( |x)\]\s+/);
      const t = box ? list[i].text.slice(box[0].length) : list[i].text;
      const pre = box ? `<input type="checkbox" disabled${box[1] === "x" ? " checked" : ""}> ` : "";
      html += `<li>${pre}${inline(t)}</li>`;
      i++;
    }
    html += ordered ? "</ol>" : "</ul>";
    return [html, i];
  };
  return build(items, 0, items[0].indent)[0];
}

function md(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let out = "", para = [];
  const flush = () => { if (para.length) { out += `<p>${inline(para.join(" "))}</p>\n`; para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      flush();
      const body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      const lang = fence[1] || "text";
      if (lang === "quiz") { out += quiz(body); continue; }
      out += `<div class="code"><span class="lang">${esc(lang)}</span><button class="copy" type="button">Copy</button><pre><code>${esc(body.join("\n"))}</code></pre></div>\n`;
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    if (isRawHtml(line)) { flush(); out += line.replace(/<summary>(.*?)<\/summary>/, (_, t) => `<summary>${inline(t)}</summary>`) + "\n"; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); const n = h[1].length; out += `<h${n} id="${slug(h[2])}">${inline(h[2])}</h${n}>\n`; continue; }
    if (/^---+\s*$/.test(line)) { flush(); out += "<hr>\n"; continue; }
    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || "")) {
      flush();
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, "|")));
      out += "<div class=\"table\"><table><thead><tr>" + cells(line).map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>";
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) out += "<tr>" + cells(lines[i]).map((c) => `<td>${c}</td>`).join("") + "</tr>";
      i--; out += "</tbody></table></div>\n"; continue;
    }
    if (/^>\s?/.test(line)) {
      flush(); const q = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) q.push(lines[i].replace(/^>\s?/, ""));
      i--; out += `<blockquote>${md(q.join("\n"))}</blockquote>\n`; continue;
    }
    if (isListLine(line)) {
      flush(); const block = [];
      for (; i < lines.length && (isListLine(lines[i]) || (/^\s+\S/.test(lines[i]) && block.length)); i++) block.push(lines[i]);
      i--; out += renderList(block) + "\n"; continue;
    }
    para.push(line.trim());
  }
  flush();
  return out;
}

// ── Quizzes: ```quiz blocks → instant-feedback cards; also collected for the Review tab ──
let quizSink = null;
function quiz(lines) {
  const q = { question: "", options: [], answer: -1, why: "" };
  for (const l of lines) {
    const opt = l.match(/^\s*-\s*\[( |x)\]\s+(.*)$/);
    if (opt) { if (opt[1] === "x") q.answer = q.options.length; q.options.push(opt[2]); }
    else if (/^>\s?/.test(l)) q.why += (q.why ? " " : "") + l.replace(/^>\s?/, "");
    else if (l.trim()) q.question += (q.question ? " " : "") + l.trim();
  }
  if (quizSink) quizSink.push(q);
  return `<div class="quiz" data-answer="${q.answer}"><p class="quiz-q">${inline(q.question)}</p><div class="quiz-opts">` +
    q.options.map((o, i) => `<button type="button" class="quiz-opt" data-i="${i}">${inline(o)}</button>`).join("") +
    `</div><p class="quiz-why" hidden>${inline(q.why)}</p></div>
`;
}

// ── Lessons ────────────────────────────────────────────────────────────────
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return [{}, text];
  const meta = {};
  for (const l of m[1].split("\n")) { const kv = l.match(/^(\w+):\s*(.*)$/); if (kv) meta[kv[1]] = kv[2].trim(); }
  return [meta, text.slice(m[0].length)];
}

const lessons = existsSync(lessonsDir)
  ? readdirSync(lessonsDir).filter((f) => f.endsWith(".md")).sort().map((f) => {
      const [meta, body] = frontMatter(readFileSync(join(lessonsDir, f), "utf8").replace(/\r\n/g, "\n"));
      const id = f.replace(/\.md$/, "");          // TKT-104 or TKT-104-1 (one lesson per slice for big tickets)
      const ticket = meta.ticket || id;
      // concepts = ### headings inside "## Under the hood"
      const concepts = [];
      const under = body.split(/^## /m).find((s) => s.startsWith("Under the hood"));
      if (under) for (const m of under.matchAll(/^### (.+)$/gm)) concepts.push({ name: m[1].replace(/[`*]/g, ""), anchor: slug(m[1]) });
      quizSink = [];
      const html = md(body);
      const quizzes = quizSink.map((q) => ({ ...q, question: q.question, lesson: id }));
      quizSink = null;
      return { id, ticket, title: meta.title || id, sprint: meta.sprint || "?", points: meta.points || "", status: meta.status || "lesson",
               started: meta.started || "", finished: meta.finished || "", source: meta.source || "", html, text: body, concepts, quizzes };
    })
  : [];

const notesPath = join(here, "LEARNING-NOTES.md");
const notesHtml = existsSync(notesPath) ? md(readFileSync(notesPath, "utf8")) : "<p>No notes yet.</p>";

// ── Sprints: ROADMAP (calendar, sprint map, stretch) + sprint files (ticket bodies) ──
const processDir = join(here, "..", "process");
const roadmap = existsSync(join(processDir, "ROADMAP.md")) ? readFileSync(join(processDir, "ROADMAP.md"), "utf8").replace(/\r\n/g, "\n") : "";
const section = (text, title) => { const i = text.indexOf("\n## " + title); if (i < 0) return ""; const rest = text.slice(i + 4); const j = rest.indexOf("\n## "); return j < 0 ? rest : rest.slice(0, j); };
const rows = (text) => text.split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
const lessonsByTicket = {};
for (const l of lessons) (lessonsByTicket[l.ticket] ||= []).push(l);

const calendar = {};
for (const r of rows(section(roadmap, "Calendar"))) if (/^\d+$/.test(r[0])) calendar[r[0]] = { dates: r[1], milestone: r[3].replace(/\*/g, "") };

const sprintFiles = {};
const sprintsDir = join(processDir, "sprints");
if (existsSync(sprintsDir)) for (const f of readdirSync(sprintsDir).filter((f) => /^SPRINT-\d+\.md$/.test(f))) {
  const n = String(+f.match(/\d+/)[0]);
  const text = readFileSync(join(sprintsDir, f), "utf8").replace(/\r\n/g, "\n");
  const goal = (text.match(/\|\s*\*\*Sprint goal\*\*\s*\|\s*(.+?)\s*\|\s*$/m) || [])[1] || "";
  const bodies = {};
  for (const part of text.split(/^## (?=TKT-\d+ )/m).slice(1)) {
    const id = part.match(/^(TKT-\d+)/)[1];
    bodies[id] = part.slice(part.indexOf("\n") + 1).split(/\n---\n|\n## /)[0].trim();
  }
  sprintFiles[n] = { goal, bodies, file: f };
}

const statusOf = (id, title) => {
  const ls = lessonsByTicket[id];
  if (ls) return ls.every((l) => l.status === "done") ? "done" : ls.some((l) => l.status === "in-progress") ? "in-progress" : ls[0].status;
  return /✅/.test(title) ? "done" : "planned";
};
const label = { done: "Done", "in-progress": "In progress", lesson: "Lesson ready", planned: "Planned" };
const sprints = [];
for (const part of section(roadmap, "Sprint map").split(/^### Sprint /m).slice(1)) {
  const head = part.split("\n")[0];
  const n = head.match(/^(\d+)/)[1];
  const title = head.replace(/^\d+\s*—\s*/, "").split(" · ")[0];
  const pts = (head.match(/(\d+)\s*pts/) || [])[1] || "";
  const ms = (head.match(/→\s*(.+)$/) || [])[1] || "";
  const tickets = rows(part).filter((r) => /^TKT-\d+$/.test(r[0])).map((r) => ({ id: r[0], title: r[1].replace(/\s*✅\s*/, ""), pts: r[2], status: statusOf(r[0], r[1]) }));
  sprints.push({ n, title, pts, ms, tickets, dates: calendar[n]?.dates || "", goal: sprintFiles[n]?.goal || "", bodies: sprintFiles[n]?.bodies || {} });
}
const stretch = rows(section(roadmap, "⭐ Stretch goals")).filter((r) => /^STR-\d+$/.test(r[0])).map((r) => ({ id: r[0], title: r[1], pts: r[2], status: "planned" }));
const current = sprints.find((s) => s.tickets.some((t) => t.status !== "done"))?.n;

const ticketHtml = (t, body) => {
  const row = `<div class="ticket-row"><span class="id">${t.id}</span><span class="t">${inline(t.title)}</span>` +
    `<span class="pill ${t.status}">${label[t.status]}</span><span class="pts">${esc(t.pts)} pts</span></div>`;
  const lessonLink = (lessonsByTicket[t.id] || []).map((l) => `<a class="lesson-link" href="#${l.id}">Lesson: ${esc(l.title)} →</a>`).join(" · ");
  return body
    ? `<details class="ticket" id="ticket-${t.id}"><summary>${row}</summary><div class="ticket-body">${lessonLink ? `<p>${lessonLink}</p>` : ""}${md(body)}</div></details>`
    : `<div class="ticket" id="ticket-${t.id}">${row.replace("</div>", "<span></span></div>")}${lessonLink ? `<div class="ticket-body"><p>${lessonLink}</p></div>` : ""}</div>`;
};
const allTickets = sprints.flatMap((s) => s.tickets);
const sprintsHtml = `<div class="sprint-summary">
<div class="stat"><b>${sprints.length}</b><span>sprints to M3</span></div>
<div class="stat"><b>${allTickets.length}</b><span>tickets</span></div>
<div class="stat"><b>${allTickets.filter((t) => t.status === "done").length}</b><span>done</span></div>
<div class="stat"><b>${allTickets.reduce((a, t) => a + (+t.pts || 0), 0)}</b><span>points to M3</span></div>
<div class="stat"><b>${stretch.length}</b><span>stretch goals</span></div></div>
` + sprints.map((s) => `<details class="sprint${s.n === current ? " current" : ""}"${s.n === current || Object.keys(s.bodies).length ? " open" : ""}>
<summary><span class="sprint-title"><span class="num">${s.n}</span>${inline(s.title)}${s.n === current ? '<span class="badge">current</span>' : ""}${s.ms ? `<span class="badge soft">${esc(s.ms.replace(/\*/g, ""))}</span>` : ""}</span>
<span class="sprint-meta">${esc(s.dates)} · ${esc(s.pts)} pts</span>${s.goal ? `<span class="sprint-goal">${inline(s.goal)}</span>` : ""}</summary>
<div class="tickets">${s.tickets.map((t) => ticketHtml(t, s.bodies[t.id])).join("")}</div></details>`).join("\n") +
  (stretch.length ? `\n<details class="sprint"><summary><span class="sprint-title"><span class="num">⭐</span>Stretch goals<span class="badge soft">after M3</span></span><span class="sprint-meta">pick in any order</span></summary>
<div class="tickets">${stretch.map((t) => ticketHtml(t, "")).join("")}</div></details>` : "");

const data = { built: new Date().toISOString().slice(0, 16).replace("T", " "), lessons: lessons.map(({ html, quizzes, ...rest }) => rest),
  quizzes: lessons.flatMap((l) => l.quizzes.map((q) => ({ ...q, question: inline(q.question), options: q.options.map(inline), why: inline(q.why) }))),
  tickets: [...allTickets.map((t) => ({ id: t.id, title: t.title, sprint: "Sprint " + sprints.find((s) => s.tickets.includes(t)).n })),
            ...stretch.map((t) => ({ id: t.id, title: t.title, sprint: "Stretch" }))] };
const articles = lessons.map((l) => `<article class="lesson" id="lesson-${l.id}" data-id="${l.id}" hidden>
<header class="lesson-head"><p class="eyebrow">Sprint ${esc(l.sprint)} · ${esc(l.points)} pts${l.source ? ` · Primary source: ${inline(l.source)}` : ""}</p>
<h1>${esc(l.id)} — ${esc(l.title)}</h1><span class="pill ${l.status}">${l.status === "done" ? "Done" : l.status === "in-progress" ? "In progress" : "Lesson ready"}</span></header>
${l.html.replace(/<h1[^>]*>.*?<\/h1>\n?/, "")}</article>`).join("\n");

const template = readFileSync(join(here, "template.html"), "utf8");
const page = template
  .replace("/*__DATA__*/", JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("<!--__ARTICLES__-->", articles)
  .replace("<!--__NOTES__-->", notesHtml)
  .replace("<!--__SPRINTS__-->", sprintsHtml);
writeFileSync(join(here, "index.html"), page);
console.log(`learning site: ${lessons.length} lesson(s) → ${join(here, "index.html")}`);
