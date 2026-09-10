"use strict";

/* ---------- tuning knobs (ajusta à experiência de campo) ---------- */
const LEN_TOLERANCE_DEFAULT = 0; // mm — acima disto, len é hard fail
const WEIGHTS = { pax: 1.0, main: 1.2, add: 1.5, len: 0.8 };
const SAFE_THRESHOLD = 90; // score >= isto => "compromisso seguro"
const RISK_THRESHOLD = 60; // score >= isto => "compromisso arriscado"
const VIZ_RISK_MM = 3; // desvio de fronteira (mm) a partir do qual o visualizador marca a vermelho

const STORAGE_DB = "pectab.db";
const STORAGE_HISTORY = "pectab.history";

/* ---------- storage ---------- */
function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_DB);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Falha a ler base local, a começar vazia.", e);
    return [];
  }
}

function saveDb(db) {
  localStorage.setItem(STORAGE_DB, JSON.stringify(db));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Falha a ler histórico local, a começar vazio.", e);
    return {};
  }
}

function saveHistory(hist) {
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(hist));
}

// encapsula guardar + voltar a desenhar, para nenhuma mutação de state.db
// ficar sem persistir ou sem refletir-se na lista por esquecimento.
function commitDb() {
  saveDb(state.db);
  renderDbList();
}

function commitHistory() {
  saveHistory(state.history);
}

/* ---------- state ---------- */
const state = {
  db: loadDb(),
  history: loadHistory(),
  results: [], // { pectab, score, classification, deltas, reasons }
  excluded: [], // { pectab, reason }
  selected: null, // id of pectab shown in visualizer
  lastPhysical: null,
  orderOverride: null, // null = usa dir do registo selecionado; "pax-first" | "add-first" força
};

/* ---------- matching engine ---------- */
function sectionSum(rec) {
  return rec.pax + rec.main + rec.st * rec.add;
}

function matchOne(physical, rec) {
  const reasons = [];

  if (physical.dir !== rec.dir) {
    return { hardFail: true, reason: { key: "fail.dir", params: { measured: physical.dir, rec: rec.dir } } };
  }
  if (physical.st !== rec.st) {
    return { hardFail: true, reason: { key: "fail.st", params: { measured: physical.st, rec: rec.st } } };
  }
  const lenDelta = Math.abs(physical.len - rec.len);
  if (lenDelta > physical.lenTolerance) {
    return { hardFail: true, reason: { key: "fail.len", params: { delta: lenDelta, tolerance: physical.lenTolerance } } };
  }

  const deltas = {
    pax: physical.pax - rec.pax,
    main: physical.main - rec.main,
    add: physical.add - rec.add,
    len: physical.len - rec.len,
  };

  const penalty =
    Math.abs(deltas.pax) * WEIGHTS.pax +
    Math.abs(deltas.main) * WEIGHTS.main +
    Math.abs(deltas.add) * WEIGHTS.add * Math.max(1, rec.st / 2) +
    Math.abs(deltas.len) * WEIGHTS.len;

  const score = Math.max(0, Math.round(100 - penalty));

  let classification;
  if (deltas.pax === 0 && deltas.main === 0 && deltas.add === 0 && deltas.len === 0) {
    classification = "exact";
  } else if (score >= SAFE_THRESHOLD) {
    classification = "safe";
  } else if (score >= RISK_THRESHOLD) {
    classification = "risky";
  } else {
    classification = "recompile";
  }

  const declaredSum = sectionSum(rec);
  if (declaredSum !== rec.len) {
    reasons.push({ key: "warn.lenSum", params: { len: rec.len, sum: declaredSum, diff: Math.abs(declaredSum - rec.len) } });
  }
  if (rec.eq === false) {
    reasons.push({ key: "warn.eqN" });
  }

  return { hardFail: false, score, classification, deltas, reasons };
}

function runMatching(physical) {
  const results = [];
  const excluded = [];
  for (const rec of state.db) {
    const m = matchOne(physical, rec);
    if (m.hardFail) {
      excluded.push({ pectab: rec, reason: m.reason });
    } else {
      results.push({ pectab: rec, score: m.score, classification: m.classification, deltas: m.deltas, reasons: m.reasons });
    }
  }
  results.sort((a, b) => b.score - a.score);
  state.results = results;
  state.excluded = excluded;
  state.lastPhysical = physical;
}

/* ---------- layout order for visualizer ---------- */
function sectionsFor(rec, orderMode) {
  const mode = orderMode || (rec.dir === "ADD" ? "add-first" : "pax-first");
  const stubs = Array.from({ length: rec.st }, (_, i) => ({ type: "ADD", label: `ADD${i + 1}`, len: rec.add }));
  const pax = { type: "PAX", label: "PAX", len: rec.pax };
  const main = { type: "MAIN", label: "MAIN", len: rec.main };
  return mode === "add-first" ? [...stubs, main, pax] : [pax, main, ...stubs];
}

const TYPE_COLOR = { PAX: "#2f6feb", MAIN: "#8957e5", ADD: "#c9820b" };

/* ---------- rendering ---------- */
const el = (id) => document.getElementById(id);

function classLabel(c) {
  return t(`class.${c}`);
}

function classExplain(c) {
  return t(`classExplain.${c}`);
}

function fieldLabel(field) {
  return t(`field.label.${field}`);
}

// frase legível para um desvio: delta = medido - PECTAB. positivo => PECTAB mais curto nesse campo.
function deltaPhrase(field, delta) {
  const label = fieldLabel(field);
  if (delta === 0) return t("delta.equal", { label });
  if (delta > 0) return t("delta.shorter", { label, delta: Math.abs(delta) });
  return t("delta.longer", { label, delta: Math.abs(delta) });
}

function renderDbList() {
  const tbody = el("db-list-body");
  tbody.innerHTML = "";
  if (state.db.length === 0) {
    el("db-empty").hidden = false;
    return;
  }
  el("db-empty").hidden = true;
  for (const rec of state.db) {
    const tr = document.createElement("tr");
    tr.className = rec.id === state.selected ? "selected" : "";
    tr.dataset.id = rec.id;
    const eqBadge = rec.eq === false ? `<span class="badge risky" title="${t("field.eqBadge.title")}">eq=N</span>` : "";
    tr.innerHTML = `<td>${rec.id}</td><td>${rec.dir}</td><td>${rec.len}</td><td>${rec.st}</td><td>${eqBadge}</td>`;
    tbody.appendChild(tr);
  }
}

function renderResults() {
  const wrap = el("results-wrap");
  wrap.innerHTML = "";

  if (!state.lastPhysical) {
    wrap.innerHTML = `<p class="empty-state">${t("results.empty.noSearch")}</p>`;
    return;
  }

  if (state.results.length === 0) {
    wrap.innerHTML = `<p class="empty-state">${t("results.empty.noCandidates")}</p>`;
  }

  for (const r of state.results) {
    const card = document.createElement("div");
    card.className = "result-card" + (r.pectab.id === state.selected ? " active" : "");
    card.dataset.id = r.pectab.id;
    const deltaItems = ["pax", "main", "add", "len"]
      .map((f) => `<li${r.deltas[f] === 0 ? ' class="ok"' : ""}>${deltaPhrase(f, r.deltas[f])}</li>`)
      .join("");
    card.innerHTML = `
      <div class="top">
        <span class="id">${r.pectab.id}</span>
        <span class="badge ${r.classification}">${classLabel(r.classification)} · ${r.score}</span>
      </div>
      <p class="result-explain">${classExplain(r.classification)}</p>
      <ul class="result-deltas">${deltaItems}</ul>
      ${r.reasons.length ? `<ul class="result-warnings">${r.reasons.map((w) => `<li>${t(w.key, w.params)}</li>`).join("")}</ul>` : ""}
    `;
    wrap.appendChild(card);
  }

  const exWrap = el("excluded-wrap");
  exWrap.innerHTML = "";
  if (state.excluded.length === 0) {
    exWrap.innerHTML = `<p class="empty-state">${t("excluded.empty")}</p>`;
  } else {
    const ul = document.createElement("ul");
    ul.className = "excluded-list";
    for (const x of state.excluded) {
      const li = document.createElement("li");
      li.textContent = `${x.pectab.id} — ${t(x.reason.key, x.reason.params)}`;
      ul.appendChild(li);
    }
    exWrap.appendChild(ul);
  }
}

function fmtDelta(v) {
  if (v === 0) return "0mm";
  return (v > 0 ? "+" : "") + v + "mm";
}

function renderVisualizer() {
  const svgHost = el("viz-svg");
  const rec = state.db.find((r) => r.id === state.selected);
  if (!rec) {
    svgHost.innerHTML = `<p class="empty-state">${t("viz.empty.noSelection")}</p>`;
    return;
  }

  const physical = state.lastPhysical;
  const orderMode = state.orderOverride;
  const recSections = sectionsFor(rec, orderMode);
  const physSections = physical ? sectionsFor(physical, orderMode || (physical.dir === "ADD" ? "add-first" : "pax-first")) : null;

  const totalMm = Math.max(rec.len, physical ? physical.len : 0, sectionSum(rec));
  const pxPerMm = Math.min(6, 900 / totalMm);
  const barH = 46;
  const gapY = 16;
  const marginX = 22;
  const width = Math.ceil(totalMm * pxPerMm) + marginX * 2;
  const rows = physical ? 2 : 1;
  const height = rows * (barH + gapY) + 40;

  let y = 20;
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  if (physical) {
    svg += renderBar(physSections, marginX, y, pxPerMm, barH, t("viz.row.physical"));
    y += barH + gapY;
  }
  svg += renderBar(recSections, marginX, y, pxPerMm, barH, t("viz.row.logical", { id: rec.id }));

  // declared len line
  const lenX = marginX + rec.len * pxPerMm;
  svg += `<line x1="${lenX}" y1="10" x2="${lenX}" y2="${height - 10}" stroke="#cf222e" stroke-dasharray="4,3" stroke-width="1.5"/>`;

  const sum = sectionSum(rec);
  const summaryLines = [];
  summaryLines.push(`<span style="color:#cf222e">┃</span> ${t("viz.summary.declaredLen", { id: rec.id, len: rec.len })}`);

  if (sum !== rec.len) {
    const sumX = marginX + sum * pxPerMm;
    svg += `<line x1="${sumX}" y1="10" x2="${sumX}" y2="${height - 10}" stroke="#9a6700" stroke-dasharray="2,2" stroke-width="1.5"/>`;
    summaryLines.push(
      `<span style="color:#9a6700">┊</span> ${t("viz.summary.sectionSum", { id: rec.id, sum, delta: fmtDelta(sum - rec.len) })}`
    );
  }

  // boundary mismatch annotations vs physical
  if (physical) {
    const { markup, deltas } = boundaryDeltas(physSections, recSections, pxPerMm, height, marginX);
    svg += markup;
    for (const d of deltas) {
      summaryLines.push(
        `<span style="color:#cf222e">│</span> ${t("viz.summary.boundaryDelta", { label: d.label, id: rec.id, delta: fmtDelta(d.delta) })}`
      );
    }
  }

  svg += "</svg>";
  svgHost.innerHTML = svg;

  const summaryHost = el("viz-summary");
  if (summaryHost) {
    summaryHost.innerHTML = summaryLines.length
      ? `<ul class="excluded-list">${summaryLines.map((l) => `<li>${l}</li>`).join("")}</ul>`
      : `<p class="empty-state">${t("viz.summary.empty")}</p>`;
  }
}

// barra simples de blocos de cor lisa por secção, com "A"/"B" nas pontas
// (como o esquema de referência) e uma linha fina a marcar cada corte.
function renderBar(sections, x0, y0, pxPerMm, h, label) {
  let x = x0;
  let out = `<text x="${x0}" y="${y0 - 4}">${label}</text>`;

  for (const s of sections) {
    const w = Math.max(1, s.len * pxPerMm);
    out += `<rect x="${x}" y="${y0}" width="${w}" height="${h}" fill="${TYPE_COLOR[s.type]}"/>`;
    if (w >= s.label.length * 6 + 4) {
      out += `<text x="${x + w / 2}" y="${y0 + h / 2 + 3}" fill="#fff" font-size="9" text-anchor="middle">${s.label}</text>`;
    }
    x += w;
  }

  // linhas de corte entre secções (não são desvios, são cortes reais da etiqueta)
  let cutX = x0;
  for (let i = 0; i < sections.length - 1; i++) {
    cutX += sections[i].len * pxPerMm;
    out += `<line x1="${cutX}" y1="${y0}" x2="${cutX}" y2="${y0 + h}" stroke="#000" stroke-width="1"/>`;
  }

  out += `<rect x="${x0}" y="${y0}" width="${x - x0}" height="${h}" fill="none" stroke="#333" stroke-width="1"/>`;
  out += `<text x="${x0 - 8}" y="${y0 + h / 2 + 4}" text-anchor="end" font-weight="bold">A</text>`;
  out += `<text x="${x + 8}" y="${y0 + h / 2 + 4}" text-anchor="start" font-weight="bold">B</text>`;
  return out;
}

function boundaryDeltas(physSections, recSections, pxPerMm, height, marginX) {
  const physBoundaries = cumulativeBoundaries(physSections);
  const recBoundaries = cumulativeBoundaries(recSections);
  const n = Math.min(physBoundaries.length, recBoundaries.length) - 1; // ignore final edge (=total len, already shown)
  let markup = "";
  const deltas = [];
  let prevDelta = 0;
  for (let i = 1; i < n; i++) {
    const delta = recBoundaries[i] - physBoundaries[i];
    // só assinala onde o desvio COMEÇA — se o desvio se mantiver igual ao
    // da fronteira anterior, é a mesma causa a propagar-se, não um novo problema
    if (Math.abs(delta) >= VIZ_RISK_MM && delta !== prevDelta) {
      const x = marginX + physBoundaries[i] * pxPerMm;
      const label = physSections[i - 1] ? t("viz.boundary.end", { section: physSections[i - 1].label }) : t("viz.boundary.generic", { n: i });
      markup += `<line x1="${x}" y1="10" x2="${x}" y2="${height - 10}" stroke="#cf222e" stroke-width="1"/>`;
      markup += `<text x="${x + 2}" y="${20 + (height - 40) * (i / n)}" fill="#cf222e">${label} Δ${delta > 0 ? "+" : ""}${delta}mm</text>`;
      deltas.push({ label, delta });
    }
    prevDelta = delta;
  }
  return { markup, deltas };
}

function cumulativeBoundaries(sections) {
  const bounds = [0];
  let acc = 0;
  for (const s of sections) {
    acc += s.len;
    bounds.push(acc);
  }
  return bounds;
}

/* ---------- history ---------- */
function renderHistory() {
  const wrap = el("history-wrap");
  wrap.innerHTML = "";
  const rec = state.db.find((r) => r.id === state.selected);
  if (!rec) {
    wrap.innerHTML = `<p class="empty-state">${t("history.empty.noSelection")}</p>`;
    el("history-form").hidden = true;
    return;
  }
  el("history-form").hidden = false;
  const entries = state.history[rec.id] || [];
  if (entries.length === 0) {
    wrap.innerHTML = `<p class="empty-state">${t("history.empty.noTests")}</p>`;
    return;
  }
  for (const e of [...entries].reverse()) {
    const div = document.createElement("div");
    div.className = "history-entry";
    div.innerHTML = `
      <span class="badge ${e.result === "ok" ? "safe" : "recompile"}">${e.result === "ok" ? t("history.result.ok") : t("history.result.fail")}</span>
      <strong>${e.airport || t("history.noLocation")}</strong>
      <div class="meta">${e.date}</div>
      ${e.note ? `<div>${escapeHtml(e.note)}</div>` : ""}
    `;
    wrap.appendChild(div);
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function addHistoryEntry(pectabId, entry) {
  if (!state.history[pectabId]) state.history[pectabId] = [];
  state.history[pectabId].push(entry);
  commitHistory();
}

/* ---------- compilation request export ---------- */
function exportCompilationRequest() {
  const physical = state.lastPhysical;
  if (!physical) {
    toast(t("toast.needPhysicalFirst"));
    return;
  }
  const best = state.results[0];
  const lines = [
    t("compile.title"),
    t("compile.generated", { date: new Date().toISOString() }),
    "",
    t("compile.physicalHeading"),
    `  dir=${physical.dir} st=${physical.st} len=${physical.len} pax=${physical.pax} main=${physical.main} add=${physical.add}`,
    "",
  ];
  if (best) {
    lines.push(t("compile.bestCandidate", { id: best.pectab.id, classification: classLabel(best.classification), score: best.score }));
    lines.push(`  Δpax=${best.deltas.pax} Δmain=${best.deltas.main} Δadd=${best.deltas.add} Δlen=${best.deltas.len}`);
    if (best.reasons.length) {
      lines.push(`  ${t("compile.notes", { notes: best.reasons.map((r) => t(r.key, r.params)).join("; ") })}`);
    }
  } else {
    lines.push(t("compile.noneFound"));
  }
  lines.push("", t("compile.requestedSpec"));
  lines.push(`  len=${physical.len} pax=${physical.pax} main=${physical.main} add=${physical.add} st=${physical.st} dir=${physical.dir}`);

  downloadText(`pedido-compilacao-${Date.now()}.txt`, lines.join("\n"));
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- toast ---------- */
// cada chamada empilha um toast novo (em vez de reutilizar sempre a
// mesma div) — duas ações rápidas seguidas mostram as duas mensagens,
// não só a última a sobrepor-se à primeira.
function toast(msg) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = msg;
  stack.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}

/* ---------- importar .docx (formulário de medidas físicas) ---------- */
// .docx é um .zip com word/document.xml lá dentro. Lemos o zip à mão
// (formato simples: End Of Central Directory + Central Directory) e
// descomprimimos com a DecompressionStream nativa do browser — sem
// bibliotecas externas, para a app continuar a funcionar offline/file://.

async function readDocxDocumentXml(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const EOCD_SIG = 0x06054b50;
  const CD_SIG = 0x02014b50;

  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557); // 22 (EOCD fixo) + comentário máx 65535
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error(t("docx.err.notValidZip"));

  const cdEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (view.getUint32(offset, true) !== CD_SIG) throw new Error(t("docx.err.corruptIndex"));
    const compMethod = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLen));

    if (name === "word/document.xml") {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compData = bytes.slice(dataStart, dataStart + compSize);

      let xmlBytes;
      if (compMethod === 0) {
        xmlBytes = compData;
      } else if (compMethod === 8) {
        if (typeof DecompressionStream === "undefined") {
          throw new Error(t("docx.err.noDecompression"));
        }
        const stream = new Blob([compData]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error(t("docx.err.unsupportedCompression", { method: compMethod }));
      }
      return new TextDecoder("utf-8").decode(xmlBytes);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(t("docx.err.documentXmlNotFound"));
}

function docxXmlToText(xml) {
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const lines = [];
  let para;
  while ((para = paraRe.exec(xml))) {
    let line = "";
    let t;
    textRe.lastIndex = 0;
    while ((t = textRe.exec(para[0]))) line += t[1];
    lines.push(
      line.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    );
  }
  return lines.join("\n");
}

function extractPhysicalFieldsFromText(text) {
  const found = {};
  const notes = [];

  // PECTABs só existem em mm inteiros — um formulário com decimais
  // (ex: "457.2") é arredondado, nunca aceite tal e qual.
  const roundMm = (value, label) => {
    if (value === null || isNaN(value)) return value;
    const rounded = Math.round(value);
    if (rounded !== value) notes.push(t("docx.roundedNote", { label, original: value, rounded }));
    return rounded;
  };

  const numAfterLabel = (labelRe) => {
    const m = text.match(new RegExp(labelRe + "\\s*(?:in\\s*mm)?\\s*[:=]\\s*([\\d.]+)", "i"));
    return m ? parseFloat(m[1]) : null;
  };

  found.len = roundMm(numAfterLabel("(?:bag\\s*tag\\s*length|total\\s*tag\\s*length)"), "len");
  found.pax = roundMm(numAfterLabel("(?:passenger\\s*stub\\s*length|pax\\s*stub\\s*length)"), "pax");
  found.main = roundMm(numAfterLabel("main\\s*tag\\s*(?:part\\s*)?length"), "main");

  const addMatch = text.match(/additional\s*stubs?\s*length\s*(?:in\s*mm)?\s*[:=]\s*([\d.]+(?:\s*&\s*[\d.]+)*)/i);
  if (addMatch) {
    const vals = addMatch[1]
      .split("&")
      .map((s) => Math.round(parseFloat(s.trim())))
      .filter((v) => !isNaN(v));
    found.add = vals.length ? vals[0] : null;
    if (vals.length > 1) {
      notes.push(t("docx.multiValueNote", { count: vals.length, values: vals.join(", "), first: vals[0] }));
    }
  }

  const stMatch = text.match(/(?:how\s*many\s*additional\s*stubs|number\s*of\s*additional\s*stubs|n[ºo]\.?\s*of\s*additional\s*stubs)\s*[:=]?\s*(\d+)/i);
  found.st = stMatch ? parseInt(stMatch[1], 10) : null;

  const checkedRe = /[☒☑✓✔]/;
  const paxCheckbox = text.match(/pax\s*stub\s*([☐☑☒✓✔])/i);
  const addCheckbox = text.match(/additional\s*stubs\s*([☐☑☒✓✔])/i);
  if (paxCheckbox && checkedRe.test(paxCheckbox[1])) found.dir = "PAX";
  else if (addCheckbox && checkedRe.test(addCheckbox[1])) found.dir = "ADD";

  return { found, notes };
}

async function importDocxIntoPhysicalForm(file) {
  const statusHost = el("import-docx-status");
  try {
    const buf = await file.arrayBuffer();
    const xml = await readDocxDocumentXml(buf);
    const text = docxXmlToText(xml);
    const { found, notes } = extractPhysicalFieldsFromText(text);

    const applied = [];
    const missing = [];
    const setIfFound = (id, key) => {
      if (found[key] !== null && found[key] !== undefined && !isNaN(found[key])) {
        el(id).value = found[key];
        applied.push(`${key}=${found[key]}`);
      } else {
        missing.push(key);
      }
    };
    setIfFound("phys-len", "len");
    setIfFound("phys-pax", "pax");
    setIfFound("phys-main", "main");
    setIfFound("phys-add", "add");
    setIfFound("phys-st", "st");
    if (found.dir) {
      el("phys-dir").value = found.dir;
      applied.push(`dir=${found.dir}`);
    } else {
      missing.push("dir");
    }

    let msg = applied.length ? t("docx.applied", { list: applied.join(", ") }) : t("docx.noneDetected");
    if (missing.length) msg += t("docx.missing", { list: missing.join(", ") });
    statusHost.textContent = msg;
    if (notes.length) statusHost.textContent += " " + notes.join(" ");
    toast(missing.length ? t("docx.toast.withGaps") : t("docx.toast.success"));
  } catch (e) {
    statusHost.textContent = t("docx.importError", { error: e.message });
    toast(t("docx.toast.failure"));
  }
}

/* ---------- wiring ---------- */
function readPhysicalForm() {
  const num = (id) => Number(el(id).value);
  return {
    dir: el("phys-dir").value,
    st: num("phys-st"),
    len: num("phys-len"),
    pax: num("phys-pax"),
    main: num("phys-main"),
    add: num("phys-add"),
    lenTolerance: num("phys-tolerance") || LEN_TOLERANCE_DEFAULT,
  };
}

function readPectabForm() {
  const num = (id) => Number(el(id).value);
  return {
    id: el("new-id").value.trim(),
    dir: el("new-dir").value,
    st: num("new-st"),
    len: num("new-len"),
    pax: num("new-pax"),
    main: num("new-main"),
    add: num("new-add"),
    eq: el("new-eq").value === "Y",
    dest: num("new-dest") || undefined,
    remarks: el("new-remarks").value.trim(),
  };
}

function renderAll() {
  renderDbList();
  renderResults();
  renderVisualizer();
  renderHistory();
}

function init() {
  applyStaticI18n();
  renderAll();

  el("phys-tolerance").value = LEN_TOLERANCE_DEFAULT;

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLang(btn.getAttribute("data-lang"));
      applyStaticI18n();
      renderAll();
    });
  });

  el("match-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const physical = readPhysicalForm();
    runMatching(physical);
    if (state.results.length > 0) state.selected = state.results[0].pectab.id;
    renderAll();
  });

  el("add-pectab-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const rec = readPectabForm();
    if (!rec.id) {
      toast(t("toast.missingId"));
      return;
    }
    if (state.db.some((r) => r.id === rec.id)) {
      toast(t("toast.duplicateId", { id: rec.id }));
      return;
    }
    state.db.push(rec);
    commitDb();
    ev.target.reset();
    toast(t("toast.added", { id: rec.id }));
  });

  el("db-list-body").addEventListener("click", (ev) => {
    const tr = ev.target.closest("tr");
    if (!tr) return;
    state.selected = tr.dataset.id;
    renderDbList();
    renderVisualizer();
  });

  el("results-wrap").addEventListener("click", (ev) => {
    const card = ev.target.closest(".result-card");
    if (!card) return;
    state.selected = card.dataset.id;
    renderResults();
    renderDbList();
    renderVisualizer();
  });

  el("delete-selected").addEventListener("click", () => {
    if (!state.selected) return;
    state.db = state.db.filter((r) => r.id !== state.selected);
    delete state.history[state.selected];
    commitHistory();
    state.selected = null;
    saveDb(state.db);
    renderAll();
  });

  function loadFromArray(recs, labelKey) {
    let added = 0;
    for (const rec of recs) {
      if (!state.db.some((r) => r.id === rec.id)) {
        state.db.push(rec);
        added++;
      }
    }
    commitDb();
    toast(t("toast.loadResult", { label: t(labelKey), added, skipped: recs.length - added }));
  }

  el("load-sample").addEventListener("click", () => loadFromArray(PECTAB_SAMPLE, "toast.label.sample"));
  el("load-catalog").addEventListener("click", () => loadFromArray(PECTAB_CATALOG, "toast.label.catalog"));

  el("import-json-btn").addEventListener("click", () => {
    const text = el("import-json-text").value.trim();
    if (!text) return;
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error(t("toast.invalidJsonArray"));
      let added = 0;
      for (const rec of arr) {
        if (!rec.id) continue;
        const idx = state.db.findIndex((r) => r.id === rec.id);
        if (idx >= 0) state.db[idx] = rec;
        else state.db.push(rec);
        added++;
      }
      commitDb();
      el("import-json-text").value = "";
      toast(t("toast.importedUpdated", { count: added }));
    } catch (e) {
      toast(t("toast.invalidJson", { error: e.message }));
    }
  });

  el("import-json-file").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    el("import-json-text").value = await file.text();
  });

  el("export-db-btn").addEventListener("click", () => {
    downloadText(`pectab-db-${Date.now()}.json`, JSON.stringify(state.db, null, 2));
  });

  el("order-toggle").addEventListener("change", (ev) => {
    state.orderOverride = ev.target.value || null;
    renderVisualizer();
  });

  el("export-compile-btn").addEventListener("click", exportCompilationRequest);

  el("import-docx-btn").addEventListener("click", () => {
    const file = el("import-docx-file").files[0];
    if (!file) {
      toast(t("toast.chooseDocxFirst"));
      return;
    }
    importDocxIntoPhysicalForm(file);
  });

  el("history-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!state.selected) return;
    addHistoryEntry(state.selected, {
      date: el("hist-date").value || new Date().toISOString().slice(0, 10),
      airport: el("hist-airport").value.trim(),
      result: el("hist-result").value,
      note: el("hist-note").value.trim(),
    });
    renderHistory();
    ev.target.reset();
  });
}

document.addEventListener("DOMContentLoaded", init);
