"use strict";

/* ---------- tuning knobs (ajusta à experiência de campo) ---------- */
const LEN_TOLERANCE_DEFAULT = 0; // mm — acima disto, len é hard fail
const WEIGHTS = { pax: 1.0, main: 1.2, add: 1.5 };
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
    return { hardFail: true, reason: `dir físico (${physical.dir}) != ${rec.dir}` };
  }
  if (physical.st !== rec.st) {
    return { hardFail: true, reason: `nº de talões físico (${physical.st}) != ${rec.st}` };
  }
  const lenDelta = Math.abs(physical.len - rec.len);
  if (lenDelta > physical.lenTolerance) {
    return { hardFail: true, reason: `len desvia ${lenDelta}mm (tolerância ${physical.lenTolerance}mm)` };
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
    Math.abs(deltas.add) * WEIGHTS.add * Math.max(1, rec.st / 2);

  const score = Math.max(0, Math.round(100 - penalty));

  let classification;
  if (deltas.pax === 0 && deltas.main === 0 && deltas.add === 0) {
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
    reasons.push(`aviso: len declarado (${rec.len}) != soma das secções (${declaredSum})`);
  }
  if (rec.eq === false) {
    reasons.push("aviso: eq=N — talões não são todos do mesmo tamanho, add pode não refletir cada talão");
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
  return { exact: "Match exato", safe: "Compromisso seguro", risky: "Compromisso arriscado", recompile: "Requer compilação nova" }[c] || c;
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
    const eqBadge = rec.eq === false ? '<span class="badge risky" title="talões não são todos iguais">eq=N</span>' : "";
    tr.innerHTML = `<td>${rec.id}</td><td>${rec.dir}</td><td>${rec.len}</td><td>${rec.st}</td><td>${eqBadge}</td>`;
    tr.addEventListener("click", () => {
      state.selected = rec.id;
      renderDbList();
      renderVisualizer();
    });
    tbody.appendChild(tr);
  }
}

function renderResults() {
  const wrap = el("results-wrap");
  wrap.innerHTML = "";

  if (!state.lastPhysical) {
    wrap.innerHTML = '<p class="empty-state">Introduz as medidas físicas e clica em "Procurar match" para veres candidatos.</p>';
    return;
  }

  if (state.results.length === 0) {
    wrap.innerHTML = '<p class="empty-state">Nenhum candidato passou os filtros de exclusão. Ver secção "Excluídos" abaixo, ou exporta um pedido de compilação nova.</p>';
  }

  for (const r of state.results) {
    const card = document.createElement("div");
    card.className = "result-card" + (r.pectab.id === state.selected ? " active" : "");
    card.innerHTML = `
      <div class="top">
        <span class="id">${r.pectab.id}</span>
        <span class="badge ${r.classification}">${classLabel(r.classification)} · ${r.score}</span>
      </div>
      <div class="deltas">Δpax ${fmtDelta(r.deltas.pax)} · Δmain ${fmtDelta(r.deltas.main)} · Δadd ${fmtDelta(r.deltas.add)} · Δlen ${fmtDelta(r.deltas.len)}</div>
      ${r.reasons.length ? `<div class="deltas">${r.reasons.join(" · ")}</div>` : ""}
    `;
    card.addEventListener("click", () => {
      state.selected = r.pectab.id;
      renderResults();
      renderDbList();
      renderVisualizer();
    });
    wrap.appendChild(card);
  }

  const exWrap = el("excluded-wrap");
  exWrap.innerHTML = "";
  if (state.excluded.length === 0) {
    exWrap.innerHTML = '<p class="empty-state">Nenhum candidato excluído.</p>';
  } else {
    const ul = document.createElement("ul");
    ul.className = "excluded-list";
    for (const x of state.excluded) {
      const li = document.createElement("li");
      li.textContent = `${x.pectab.id} — ${x.reason}`;
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
    svgHost.innerHTML = '<p class="empty-state">Seleciona um PECTAB na lista ou nos resultados para o visualizar.</p>';
    return;
  }

  const physical = state.lastPhysical;
  const orderMode = state.orderOverride;
  const recSections = sectionsFor(rec, orderMode);
  const physSections = physical ? sectionsFor(physical, orderMode || (physical.dir === "ADD" ? "add-first" : "pax-first")) : null;

  const totalMm = Math.max(rec.len, physical ? physical.len : 0, sectionSum(rec));
  const pxPerMm = Math.min(6, 900 / totalMm);
  const barH = 34;
  const gapY = 14;
  const width = Math.ceil(totalMm * pxPerMm) + 20;
  const rows = physical ? 2 : 1;
  const height = rows * (barH + gapY) + 40;

  let y = 20;
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  if (physical) {
    svg += renderBar(physSections, 10, y, pxPerMm, barH, "Físico (medido)");
    y += barH + gapY;
  }
  svg += renderBar(recSections, 10, y, pxPerMm, barH, `${rec.id} (lógico)`);

  // declared len line
  const lenX = 10 + rec.len * pxPerMm;
  svg += `<line x1="${lenX}" y1="10" x2="${lenX}" y2="${height - 10}" stroke="#cf222e" stroke-dasharray="4,3" stroke-width="1.5"/>`;
  svg += `<text x="${lenX + 3}" y="14">len declarado: ${rec.len}mm</text>`;

  const sum = sectionSum(rec);
  if (sum !== rec.len) {
    const sumX = 10 + sum * pxPerMm;
    svg += `<line x1="${sumX}" y1="10" x2="${sumX}" y2="${height - 10}" stroke="#9a6700" stroke-dasharray="2,2" stroke-width="1.5"/>`;
    svg += `<text x="${sumX + 3}" y="${height - 4}">soma secções: ${sum}mm (Δ${sum - rec.len}mm)</text>`;
  }

  // boundary mismatch annotations vs physical
  if (physical) {
    svg += boundaryDeltas(physSections, recSections, pxPerMm, height);
  }

  svg += "</svg>";
  svgHost.innerHTML = svg;
}

function renderBar(sections, x0, y0, pxPerMm, h, label) {
  let x = x0;
  let out = `<text x="${x0}" y="${y0 - 4}">${label}</text>`;
  for (const s of sections) {
    const w = Math.max(1, s.len * pxPerMm);
    out += `<rect x="${x}" y="${y0}" width="${w}" height="${h}" fill="${TYPE_COLOR[s.type]}" fill-opacity="0.55" stroke="${TYPE_COLOR[s.type]}"/>`;
    if (w > 18) out += `<text x="${x + 3}" y="${y0 + h / 2 + 3}">${s.label}</text>`;
    x += w;
  }
  out += `<rect x="${x0}" y="${y0}" width="${x - x0}" height="${h}" fill="none" stroke="#888" stroke-width="0.5"/>`;
  return out;
}

function boundaryDeltas(physSections, recSections, pxPerMm, height) {
  const physBoundaries = cumulativeBoundaries(physSections);
  const recBoundaries = cumulativeBoundaries(recSections);
  const n = Math.min(physBoundaries.length, recBoundaries.length) - 1; // ignore final edge (=total len, already shown)
  let out = "";
  for (let i = 1; i < n; i++) {
    const delta = recBoundaries[i] - physBoundaries[i];
    if (Math.abs(delta) >= VIZ_RISK_MM) {
      const x = 10 + physBoundaries[i] * pxPerMm;
      out += `<line x1="${x}" y1="10" x2="${x}" y2="${height - 10}" stroke="#cf222e" stroke-width="1"/>`;
      out += `<text x="${x + 2}" y="${20 + (height - 40) * (i / n)}" fill="#cf222e">Δ${delta > 0 ? "+" : ""}${delta}mm</text>`;
    }
  }
  return out;
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
    wrap.innerHTML = '<p class="empty-state">Seleciona um PECTAB para ver ou registar histórico de testes.</p>';
    el("history-form").hidden = true;
    return;
  }
  el("history-form").hidden = false;
  const entries = state.history[rec.id] || [];
  if (entries.length === 0) {
    wrap.innerHTML = '<p class="empty-state">Sem testes registados para este PECTAB.</p>';
    return;
  }
  for (const e of [...entries].reverse()) {
    const div = document.createElement("div");
    div.className = "history-entry";
    div.innerHTML = `
      <span class="badge ${e.result === "ok" ? "safe" : "recompile"}">${e.result === "ok" ? "OK" : "Falhou"}</span>
      <strong>${e.airport || "(sem local)"}</strong>
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
  saveHistory(state.history);
}

/* ---------- compilation request export ---------- */
function exportCompilationRequest() {
  const physical = state.lastPhysical;
  if (!physical) {
    toast("Introduz e procura uma medida física primeiro.");
    return;
  }
  const best = state.results[0];
  const lines = [
    "PEDIDO DE COMPILAÇÃO PECTAB",
    `Gerado: ${new Date().toISOString()}`,
    "",
    "Medidas físicas (rolo testado):",
    `  dir=${physical.dir} st=${physical.st} len=${physical.len} pax=${physical.pax} main=${physical.main} add=${physical.add}`,
    "",
  ];
  if (best) {
    lines.push(`Melhor candidato existente encontrado: ${best.pectab.id} (${classLabel(best.classification)}, score ${best.score})`);
    lines.push(`  Δpax=${best.deltas.pax} Δmain=${best.deltas.main} Δadd=${best.deltas.add} Δlen=${best.deltas.len}`);
    if (best.reasons.length) lines.push(`  Notas: ${best.reasons.join("; ")}`);
  } else {
    lines.push("Nenhum candidato existente passou os filtros de exclusão.");
  }
  lines.push("", "Especificação pedida (a partir das medidas físicas acima):");
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
let toastTimer = null;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3000);
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

function init() {
  renderDbList();
  renderResults();
  renderVisualizer();
  renderHistory();

  el("phys-tolerance").value = LEN_TOLERANCE_DEFAULT;

  el("match-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const physical = readPhysicalForm();
    runMatching(physical);
    if (state.results.length > 0) state.selected = state.results[0].pectab.id;
    renderResults();
    renderDbList();
    renderVisualizer();
    renderHistory();
  });

  el("add-pectab-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const rec = readPectabForm();
    if (!rec.id) {
      toast("Falta o ID do PECTAB.");
      return;
    }
    if (state.db.some((r) => r.id === rec.id)) {
      toast(`Já existe um PECTAB com id ${rec.id}.`);
      return;
    }
    state.db.push(rec);
    saveDb(state.db);
    renderDbList();
    ev.target.reset();
    toast(`${rec.id} adicionado.`);
  });

  el("delete-selected").addEventListener("click", () => {
    if (!state.selected) return;
    state.db = state.db.filter((r) => r.id !== state.selected);
    delete state.history[state.selected];
    saveDb(state.db);
    saveHistory(state.history);
    state.selected = null;
    renderDbList();
    renderResults();
    renderVisualizer();
    renderHistory();
  });

  async function loadFromFile(path, label) {
    try {
      const res = await fetch(path);
      const recs = await res.json();
      let added = 0;
      for (const rec of recs) {
        if (!state.db.some((r) => r.id === rec.id)) {
          state.db.push(rec);
          added++;
        }
      }
      saveDb(state.db);
      renderDbList();
      toast(`${label}: ${added} PECTAB(s) adicionados (${recs.length - added} já existiam).`);
    } catch (e) {
      toast(`Não foi possível carregar ${path} (a correr via file://? tenta um servidor local).`);
    }
  }

  el("load-sample").addEventListener("click", () => loadFromFile("data/sample-pectabs.json", "Exemplo fictício"));
  el("load-catalog").addEventListener("click", () => loadFromFile("data/pectabs.json", "Catálogo real"));

  el("import-json-btn").addEventListener("click", () => {
    const text = el("import-json-text").value.trim();
    if (!text) return;
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error("esperado um array de PECTABs");
      let added = 0;
      for (const rec of arr) {
        if (!rec.id) continue;
        const idx = state.db.findIndex((r) => r.id === rec.id);
        if (idx >= 0) state.db[idx] = rec;
        else state.db.push(rec);
        added++;
      }
      saveDb(state.db);
      renderDbList();
      el("import-json-text").value = "";
      toast(`${added} PECTAB(s) importados/atualizados.`);
    } catch (e) {
      toast("JSON inválido: " + e.message);
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
