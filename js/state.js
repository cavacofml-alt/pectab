"use strict";
/* state.js — o único objeto de estado da app, mais os dois helpers que
   nunca devem ser contornados ao mudar state.db/state.history. */

// encapsula guardar + voltar a desenhar, para nenhuma mutação de state.db
// ficar sem persistir ou sem refletir-se na lista por esquecimento.
function commitDb() {
  saveDb(state.db);
  renderDbList();
}

function commitHistory() {
  saveHistory(state.history);
  renderHistoryTable();
}

const state = {
  db: loadDb(),
  history: loadHistory(),
  results: [], // { pectab, score, classification, deltas, breakdown, reasons }
  excluded: [], // { pectab, reason }
  selected: null, // id of pectab shown in visualizer/hero
  lastPhysical: null,
  orderOverride: null, // null = usa dir do registo selecionado; "pax-first" | "add-first" força
  catalogFilter: { search: "", dir: "" },
  toleranceCompare: null, // { tolerance, top } quando alargar a tolerância muda o melhor candidato
  dirUnknown: false, // true quando a última busca foi feita com "direção desconhecida" (compara as duas)
};

// cópia superficial de um registo (incluindo o array stubLengths, que é
// referência própria) — nunca guardar em state.db um objeto vindo direto de
// PECTAB_CATALOG/PECTAB_SAMPLE, para uma edição futura em state.db nunca
// corromper essas constantes globais (ver loadFromArray e init()).
function clonePectab(rec) {
  return { ...rec, stubLengths: rec.stubLengths ? [...rec.stubLengths] : undefined };
}
