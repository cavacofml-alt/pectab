"use strict";
/* export.js — geração de ficheiros para download: CSV do histórico, pedido
   de compilação em texto e relatório de validação em texto. */

function exportHistoryCsv() {
  const rows = [["date", "pectab", "result", "airport", "note"]];
  for (const pectabId in state.history) {
    for (const e of state.history[pectabId]) rows.push([e.date || "", pectabId, e.result || "", e.airport || "", e.note || ""]);
  }
  const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadText(`historico-pectab-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
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

/* ---------- validation report export ---------- */
function exportValidationReport() {
  const physical = state.lastPhysical;
  if (!physical) {
    toast(t("toast.needPhysicalFirst"));
    return;
  }
  const r = state.results.find((r) => r.pectab.id === state.selected) || state.results[0];
  if (!r) {
    toast(t("report.noCandidate"));
    return;
  }
  const level = decisionFor(r.classification, r.pectab);
  const lines = [
    t("report.title"),
    t("report.generated", { date: new Date().toISOString() }),
    "",
    t("compile.physicalHeading"),
    `  dir=${physical.dir} st=${physical.st} len=${physical.len} pax=${physical.pax} main=${physical.main} add=${physical.add}`,
    "",
    t("report.pectabHeading", { id: r.pectab.id }),
    `  dir=${r.pectab.dir} st=${r.pectab.st} len=${r.pectab.len} pax=${r.pectab.pax} main=${r.pectab.main} add=${r.pectab.add}`,
    "",
    t("report.scoreBreakdown"),
    ...r.breakdown.map((b) => `  ${fieldLabel(b.field)}: Δ${b.delta}mm × ${b.weight.toFixed(2)} = ${b.impact.toFixed(1)}`),
    `  ${t("report.finalScore", { score: r.score })}`,
    "",
    `  ${classLabel(r.classification)} — ${classExplain(r.classification)}`,
    `  ${t(`decision.${level}`, { id: r.pectab.id })}`,
  ];
  if (r.reasons.length) {
    lines.push("", t("report.warnings"));
    r.reasons.forEach((w) => lines.push(`  - ${t(w.key, w.params)}`));
  }
  downloadText(`relatorio-validacao-${r.pectab.id}-${Date.now()}.txt`, lines.join("\n"));
}
