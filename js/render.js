"use strict";
/* render.js — tudo o que desenha HTML a partir de state (lista do
   catálogo, resultados da busca, confronto de tolerância, histórico) e o
   renderAll() que os chama todos em conjunto. */

function renderDbList() {
  const tbody = el("db-list-body");
  tbody.innerHTML = "";
  const countHost = el("catalog-count");

  if (state.db.length === 0) {
    el("db-empty").hidden = false;
    if (countHost) countHost.textContent = "";
    return;
  }
  el("db-empty").hidden = true;

  const filter = state.catalogFilter;
  const filtered = state.db.filter((rec) => {
    if (filter.dir && rec.dir !== filter.dir) return false;
    if (filter.search && !rec.id.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  if (countHost) countHost.textContent = t("catalog.count", { shown: filtered.length, total: state.db.length });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${t("catalog.noMatch")}</td></tr>`;
    return;
  }

  for (const rec of filtered) {
    const tr = document.createElement("tr");
    tr.className = rec.id === state.selected ? "selected" : "";
    tr.dataset.id = rec.id;
    const eqTitle = rec.stubLengths ? t("field.eqBadge.titleKnown", { values: rec.stubLengths.join("/") }) : t("field.eqBadge.title");
    const eqBadge = rec.eq === false ? `<span class="badge risky" title="${escapeHtml(eqTitle)}">eq=N</span>` : "";
    const inUseBadge = rec.inUse === false ? `<span class="badge recompile" title="${t("field.notInUseBadge.title")}">${t("badge.notInUse")}</span>` : "";
    // escapa campos do registo antes de os pôr em innerHTML — um PECTAB pode
    // vir de um JSON importado (colado ou de ficheiro), nunca validado quanto
    // ao conteúdo, e não queremos que texto malicioso em "id"/"dir" execute
    // como HTML.
    tr.innerHTML = `<td>${escapeHtml(rec.id)}</td><td>${escapeHtml(rec.dir)}</td><td>${escapeHtml(rec.len)}</td><td>${escapeHtml(rec.st)}</td><td>${eqBadge} ${inUseBadge}</td>`;
    tbody.appendChild(tr);
  }
}

function checklistItem(labelKey, ok, extra) {
  return `<div class="checklist-item ${ok ? "ok" : "warn"}"><span class="mark">${ok ? "✓" : "⚠"}</span> ${t(labelKey)}${extra ? ` <span class="extra">(${extra})</span>` : ""}</div>`;
}

function scoreBreakdownTable(r) {
  const rows = r.breakdown
    .map(
      (b) =>
        `<tr><td>${fieldLabel(b.field)}</td><td>${fmtDelta(b.delta)}</td><td>×${b.weight.toFixed(2)}</td><td>${b.impact.toFixed(1)}</td></tr>`
    )
    .join("");
  return `
    <details class="score-breakdown">
      <summary>${t("score.breakdown.title", { score: r.score })}</summary>
      <table>
        <thead><tr><th>${t("score.th.field")}</th><th>${t("score.th.diff")}</th><th>${t("score.th.weight")}</th><th>${t("score.th.impact")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="score-final">${t("score.final", { score: r.score })}</p>
    </details>`;
}

// PECTABs com dir/st/len/pax/main/add idênticos são fisicamente
// indistinguíveis — a medida física nunca consegue desempatar entre eles.
// Escolher "o melhor" arbitrariamente (por ordem no catálogo) escondia essa
// ambiguidade; isto encontra todos os outros candidatos nos resultados atuais
// com a mesma especificação física exata do candidato dado.
function specKey(rec) {
  return [rec.dir, rec.st, rec.len, rec.pax, rec.main, rec.add].join("|");
}

function findEquivalentGroup(r) {
  const key = specKey(r.pectab);
  return state.results.filter((other) => specKey(other.pectab) === key);
}

function renderBestMatchHtml(r) {
  const level = decisionFor(r.classification, r.pectab);
  const isTopResult = state.results[0] && state.results[0].pectab.id === r.pectab.id;
  const checklist = [
    // direção desconhecida: o gate de dir foi ignorado de propósito (ver
    // computeMatches), por isso o "✓" sozinho seria enganador — mostra qual
    // hipótese este candidato assume em concreto.
    checklistItem("checklist.dir", true, state.dirUnknown ? t("checklist.dir.hypothesis", { dir: r.pectab.dir }) : ""),
    checklistItem("checklist.st", true),
    checklistItem("checklist.len", r.deltas.len === 0, r.deltas.len !== 0 ? fmtDelta(r.deltas.len) : ""),
    checklistItem("checklist.pax", r.deltas.pax === 0, r.deltas.pax !== 0 ? fmtDelta(r.deltas.pax) : ""),
    checklistItem("checklist.main", r.deltas.main === 0, r.deltas.main !== 0 ? fmtDelta(r.deltas.main) : ""),
    checklistItem("checklist.add", r.deltas.add === 0, r.deltas.add !== 0 ? fmtDelta(r.deltas.add) : ""),
  ].join("");

  const group = findEquivalentGroup(r);
  const groupHtml =
    group.length > 1
      ? `<div class="equiv-group">
          <div class="equiv-group-title">${t("equiv.title", { count: group.length })}</div>
          <div class="equiv-group-list">
            ${group
              .map(
                (g) =>
                  `<span class="equiv-group-id${g.pectab.id === r.pectab.id ? " current" : ""}">${escapeHtml(g.pectab.id)}${g.pectab.inUse === false ? ` <span class="badge recompile">${t("badge.notInUse")}</span>` : ""}</span>`
              )
              .join("")}
          </div>
        </div>`
      : "";

  return `
    <div class="hero-card" data-id="${escapeHtml(r.pectab.id)}">
      <div class="hero-kicker">${t(isTopResult ? "hero.title.best" : "hero.title.selected")}</div>
      <div class="decision-banner decision-${level}">${DECISION_ICON[level]} ${t(`decision.${level}`, { id: r.pectab.id })}</div>
      <div class="hero-top">
        <span class="hero-id">${escapeHtml(r.pectab.id)}</span>
        <span>
          ${r.pectab.inUse === false ? `<span class="badge recompile">${t("badge.notInUse")}</span>` : ""}
          <span class="badge ${r.classification}">${classLabel(r.classification)} · ${r.score}</span>
        </span>
      </div>
      <div class="hero-subtitle">${t("hero.subtitle", { dir: r.pectab.dir, st: r.pectab.st, len: r.pectab.len })}</div>
      ${groupHtml}
      <p class="result-explain">${classExplain(r.classification)}</p>
      <div class="checklist-title">${t("checklist.title")}</div>
      <div class="checklist-grid">${checklist}</div>
      ${scoreBreakdownTable(r)}
      ${r.reasons.length ? `<ul class="result-warnings">${r.reasons.map((w) => `<li>${t(w.key, w.params)}</li>`).join("")}</ul>` : ""}
    </div>`;
}

function renderCandidateRowHtml(r) {
  return `
    <div class="candidate-row${r.pectab.id === state.selected ? " active" : ""}" data-id="${escapeHtml(r.pectab.id)}">
      <span class="id">${escapeHtml(r.pectab.id)}</span>
      ${r.pectab.inUse === false ? `<span class="badge recompile">${t("badge.notInUse")}</span>` : ""}
      <span class="badge ${r.classification}">${classLabel(r.classification)}</span>
      <span class="score">${r.score}%</span>
    </div>`;
}

function renderResults() {
  const bestWrap = el("best-match-wrap");
  const listWrap = el("candidates-list");

  const dirNote = state.lastPhysical && state.dirUnknown ? `<p class="dir-unknown-note">${t("results.dirUnknown.note")}</p>` : "";

  if (!state.lastPhysical) {
    bestWrap.innerHTML = `<p class="empty-state">${t("results.empty.noSearch")}</p>`;
    listWrap.innerHTML = "";
  } else if (state.results.length === 0) {
    bestWrap.innerHTML = dirNote + `<p class="empty-state">${t("results.empty.noCandidates")}</p>`;
    listWrap.innerHTML = "";
  } else {
    const heroResult = state.results.find((r) => r.pectab.id === state.selected) || state.results[0];
    bestWrap.innerHTML = dirNote + renderBestMatchHtml(heroResult);
    const others = state.results.filter((r) => r.pectab.id !== heroResult.pectab.id);
    listWrap.innerHTML = others.length
      ? `<div class="candidates-title">${t("candidates.title")}</div>${others.map(renderCandidateRowHtml).join("")}`
      : "";
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

  renderToleranceCompare();
  renderStockCheck();
}

function renderStockCheck() {
  const host = el("stock-check-wrap");
  if (!host) return;
  if (!state.lastPhysical) {
    host.innerHTML = "";
    return;
  }
  const notes = checkIndustryStock(state.lastPhysical);
  // sem largura preenchida e sem bater com nenhum tamanho comercial conhecido,
  // não há nada para mostrar — isso é o caso normal (não bater com um dos dois
  // tamanhos comerciais é a maioria dos PECTABs reais), não uma falha, por isso
  // não mostra uma caixa vazia.
  if (notes.length === 0) {
    host.innerHTML = "";
    return;
  }
  host.innerHTML = `
    <div class="stock-check">
      <div class="stock-check-title">${t("stock.title")}</div>
      <ul class="stock-check-list">
        ${notes.map((n) => `<li class="${n.ok ? "ok" : "warn"}"><span class="mark">${n.ok ? "✓" : "⚠"}</span> ${t(n.key, n.params)}</li>`).join("")}
      </ul>
      <p class="stock-check-source">${t("stock.sourceNote")}</p>
    </div>`;
}

function renderToleranceCompare() {
  const host = el("tolerance-compare-wrap");
  if (!host) return;
  if (!state.toleranceCompare || !state.lastPhysical) {
    host.innerHTML = "";
    return;
  }
  const strictTop = state.results[0];
  const { tolerance, top } = state.toleranceCompare;
  // "tolerância alargada a Xmm" é só o valor testado (fixo, EXTENDED_TOLERANCE_MM) —
  // não diz quanto o candidato realmente precisava. Mostra o desvio de len real de
  // cada candidato, para não parecer que ele "precisa" do valor todo testado quando
  // pode precisar de muito menos (ex: testar a 6mm pode encontrar algo que só
  // precisava de 1mm).
  const rowHtml = (labelKey, labelParams, r) => `
    <div class="tolerance-compare-row">
      <span class="tolerance-compare-label">${t(labelKey, labelParams)}</span>
      ${
        r
          ? `<span class="id">${escapeHtml(r.pectab.id)}</span><span class="delta-note">Δlen ${fmtDelta(r.deltas.len)}</span><span class="badge ${r.classification}">${classLabel(r.classification)} · ${r.score}</span>`
          : `<span class="empty-state" style="padding:0">${t("results.empty.noCandidates")}</span>`
      }
    </div>`;
  host.innerHTML = `
    <div class="tolerance-compare">
      <div class="tolerance-compare-title">${t("compare.title")}</div>
      ${rowHtml("compare.strict", { tolerance: state.lastPhysical.lenTolerance }, strictTop)}
      ${rowHtml("compare.loose", { tolerance }, top)}
      <button type="button" class="ghost" id="apply-loose-tolerance-btn">${t("compare.applyBtn", { tolerance })}</button>
    </div>`;
}

/* ---------- history (por PECTAB selecionado) ---------- */
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

/* ---------- histórico completo (todos os PECTABs, auditoria) ---------- */
function renderHistoryTable() {
  const tbody = el("history-table-body");
  const empty = el("history-table-empty");
  if (!tbody) return;
  tbody.innerHTML = "";

  const rows = [];
  for (const pectabId in state.history) {
    for (const e of state.history[pectabId]) rows.push({ pectabId, ...e });
  }
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (rows.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date || ""}</td>
      <td>${r.pectabId}</td>
      <td><span class="badge ${r.result === "ok" ? "safe" : "recompile"}">${r.result === "ok" ? t("history.result.ok") : t("history.result.fail")}</span></td>
      <td>${escapeHtml(r.airport || "")}</td>
      <td>${escapeHtml(r.note || "")}</td>
    `;
    tbody.appendChild(tr);
  }
}

function addHistoryEntry(pectabId, entry) {
  if (!state.history[pectabId]) state.history[pectabId] = [];
  state.history[pectabId].push(entry);
  commitHistory();
}

function renderAll() {
  renderDbList();
  renderResults();
  renderVisualizer();
  renderHistory();
  renderHistoryTable();
}
