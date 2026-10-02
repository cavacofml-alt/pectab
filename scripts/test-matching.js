#!/usr/bin/env node
/**
 * Testes do motor de matching (matchOne/computeMatches/decisionFor/sectionsFor)
 * contra o catálogo real. Sem dependências, sem build — corre com:
 *
 *   node scripts/test-matching.js
 *
 * Carrega data.js + js/*.js (pela MESMA ordem que index.html usa) tal como
 * estão, sem alterações, dentro de um contexto Node isolado (stub de
 * document/localStorage) — a mesma técnica já usada manualmente várias
 * vezes ao longo deste projeto para verificar o catálogo todo, agora
 * também a cobrir a ordem de carregamento real dos ficheiros divididos.
 *
 * Sai com código 0 se tudo passar, 1 se alguma asserção falhar.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..");
const dataJs = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");

// mesma ordem de <script src> que index.html usa para js/*.js — tem de ser
// esta ordem porque state.js chama loadDb()/loadHistory() (de storage.js)
// já no seu topo, e main.js usa praticamente tudo o resto.
const APP_FILES = [
  "js/config.js",
  "js/storage.js",
  "js/state.js",
  "js/dom-utils.js",
  "js/matching.js",
  "js/visualizer.js",
  "js/render.js",
  "js/export.js",
  "js/docx-import.js",
  "js/main.js",
];
const appJs = APP_FILES.map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const sandbox = {
  console,
  document: { addEventListener() {} },
  localStorage: { getItem: () => null, setItem: () => {} },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${dataJs}\n${appJs.replace('document.addEventListener("DOMContentLoaded", init);', "")}`, sandbox, {
  filename: "app-under-test.js",
});

// PECTAB_CATALOG e state são `const` de topo-de-ficheiro: vivem no ambiente
// léxico do contexto vm, não como propriedades do objeto global, por isso não
// aparecem em `sandbox` diretamente. Um segundo script no MESMO contexto
// ainda os vê (o ambiente léxico persiste por contexto) e pode expô-los.
vm.runInContext("globalThis.__exports = { PECTAB_CATALOG, state };", sandbox);

const { PECTAB_CATALOG, state } = sandbox.__exports;
const { matchOne, computeMatches, decisionFor, sectionsFor, sectionSum, cumulativeBoundaries } = sandbox;

state.db = PECTAB_CATALOG;

function fieldsOf(rec, overrides) {
  return Object.assign({ dir: rec.dir, st: rec.st, len: rec.len, pax: rec.pax, main: rec.main, add: rec.add, lenTolerance: 0 }, overrides);
}

function byId(id) {
  const rec = PECTAB_CATALOG.find((r) => r.id === id);
  if (!rec) throw new Error(`fixture ausente do catálogo: ${id}`);
  return rec;
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
  }
}

/* ---------- self-match exato ---------- */

test("self-match exato (P2601) -> exact/100/use", () => {
  const rec = byId("P2601");
  const m = matchOne(fieldsOf(rec), rec);
  assert.strictEqual(m.hardFail, false);
  assert.strictEqual(m.score, 100);
  assert.strictEqual(m.classification, "exact");
  assert.strictEqual(decisionFor(m.classification, rec), "use");
});

test("self-match de TODO o catálogo é sempre exact, sem crash", () => {
  for (const rec of PECTAB_CATALOG) {
    const m = matchOne(fieldsOf(rec), rec);
    assert.strictEqual(m.hardFail, false, `${rec.id}: hard fail no self-match (impossível)`);
    assert.strictEqual(m.classification, "exact", `${rec.id}: self-match não deu exact`);
    assert.strictEqual(m.score, 100, `${rec.id}: self-match não deu 100`);
  }
});

/* ---------- desvios num único campo ---------- */

test("desvio em main (-4mm) -> score desce, continua hard-pass", () => {
  const rec = byId("P2601"); // main=322
  const m = matchOne(fieldsOf(rec, { main: rec.main - 4 }), rec);
  assert.strictEqual(m.hardFail, false);
  assert.strictEqual(m.deltas.main, -4);
  assert.ok(m.score < 100, "score devia descer com main errado");
});

test("desvio em pax (+4mm) -> score desce", () => {
  const rec = byId("P2601");
  const m = matchOne(fieldsOf(rec, { pax: rec.pax + 4 }), rec);
  assert.strictEqual(m.deltas.pax, 4);
  assert.ok(m.score < 100);
});

test("desvio pequeno em add (-1mm) pesa mais que o mesmo desvio em pax", () => {
  const rec = byId("P2601"); // st=3
  const mAdd = matchOne(fieldsOf(rec, { add: rec.add - 1 }), rec);
  const mPax = matchOne(fieldsOf(rec, { pax: rec.pax - 1 }), rec);
  // o desvio em "add" acumula por talão (st=3) — tem de pesar mais do que
  // o mesmo desvio em "pax", que não se repete.
  assert.ok(mAdd.score < mPax.score, `add(-1) devia pesar mais: add=${mAdd.score} pax=${mPax.score}`);
});

test("add desalinhado por talão (st>1, eq!=false) nunca classifica 'safe' mesmo com score alto", () => {
  // P2601: st=3, addWeight=1.5*3=4.5 -> delta=1mm só penaliza 4.5 (score=96,
  // ainda "safe" pela pontuação pura) mas o desalinhamento acumulado por
  // talão é um risco físico real (3º talão sai 3mm fora) e tem de forçar
  // "risky" através do caso especial, não só da pontuação.
  const rec = byId("P2601"); // eq=true, st=3
  const m = matchOne(fieldsOf(rec, { add: rec.add + 1 }), rec);
  assert.ok(m.score >= 90, `esperava score>=90 para isolar o caso especial, obteve ${m.score}`);
  assert.notStrictEqual(m.classification, "safe", "add desalinhado por talão não devia poder ser 'safe'");
  assert.ok(m.reasons.some((r) => r.key === "warn.addMisalign"), "devia ter o aviso de desalinhamento acumulado");
});

/* ---------- hard fails ---------- */

test("direção diferente -> hard fail", () => {
  const rec = byId("P2601"); // ADD
  const m = matchOne(fieldsOf(rec, { dir: "PAX" }), rec);
  assert.strictEqual(m.hardFail, true);
  assert.strictEqual(m.reason.key, "fail.dir");
});

test("nº de talões diferente -> hard fail", () => {
  const rec = byId("P2601"); // st=3
  const m = matchOne(fieldsOf(rec, { st: rec.st + 1 }), rec);
  assert.strictEqual(m.hardFail, true);
  assert.strictEqual(m.reason.key, "fail.st");
});

test("len fora da tolerância -> hard fail; dentro da tolerância -> passa", () => {
  const rec = byId("P2601");
  const tooFar = matchOne(fieldsOf(rec, { len: rec.len + 5, lenTolerance: 2 }), rec);
  assert.strictEqual(tooFar.hardFail, true);
  assert.strictEqual(tooFar.reason.key, "fail.len");
  const closeEnough = matchOne(fieldsOf(rec, { len: rec.len + 2, lenTolerance: 2 }), rec);
  assert.strictEqual(closeEnough.hardFail, false);
});

/* ---------- eq=false / stubLengths ---------- */

test("stubLengths usado na soma das secções, não 'add' uniforme (P5001)", () => {
  const rec = byId("P5001"); // stubLengths: [16, 20], add nominal 16
  const sum = sectionSum(rec);
  assert.strictEqual(sum, rec.pax + rec.main + rec.stubLengths.reduce((a, b) => a + b, 0));
  assert.strictEqual(sum, rec.len, "P5001 devia bater certo exatamente com stubLengths reais");
});

test("sectionsFor desenha cada talão com o comprimento real quando há stubLengths", () => {
  const rec = byId("P5001");
  const sections = sectionsFor(rec, "add-first");
  const addSections = sections.filter((s) => s.type === "ADD");
  assert.deepStrictEqual(
    addSections.map((s) => s.len),
    rec.stubLengths
  );
});

test("sem stubLengths, todos os talões usam o valor nominal de 'add'", () => {
  const rec = byId("P2601"); // eq=true, sem stubLengths
  const sections = sectionsFor(rec, "add-first");
  const addSections = sections.filter((s) => s.type === "ADD");
  assert.ok(addSections.every((s) => s.len === rec.add));
});

// os testes de stubLengths acima só provam que sectionSum/sectionsFor
// desenham os comprimentos reais — não provam que o PRÓPRIO matchOne
// interpreta eq=false corretamente em todos os caminhos de decisão. Os
// dois testes seguintes cobrem esse lado, com um fixture real do catálogo
// que não tem stubLengths (P5003: eq=false, st=2, sem stubLengths).

test("eq=false sem stubLengths -> aviso warn.eqN (não warn.eqNKnown)", () => {
  const rec = byId("P5003");
  assert.strictEqual(rec.eq, false, "P5003 deixou de ser eq=false — escolhe outro fixture");
  assert.strictEqual(rec.stubLengths, undefined, "P5003 deixou de ser o fixture sem stubLengths — escolhe outro");
  const m = matchOne(fieldsOf(rec), rec);
  assert.ok(m.reasons.some((r) => r.key === "warn.eqN"), "devia avisar com warn.eqN quando eq=false e não há stubLengths");
  assert.ok(!m.reasons.some((r) => r.key === "warn.eqNKnown"), "não devia usar warn.eqNKnown sem stubLengths");
});

test("eq=false nunca aciona a regra especial de 'add' uniforme (warn.addMisalign), mesmo com score alto e st>1", () => {
  // a regra de desalinhamento acumulado (ver matchOne) só faz sentido para
  // talões supostamente TODOS IGUAIS (eq!=false) — um eq=false já assume
  // talões diferentes entre si, por isso um "add" que não bate não é o
  // mesmo problema e não deve forçar 'risky' por essa via.
  const rec = byId("P5003"); // eq=false, st=2
  const m = matchOne(fieldsOf(rec, { add: rec.add + 1 }), rec); // desvio pequeno: score ficaria "safe" por pontuação pura
  assert.ok(m.score >= 90, `esperava score>=90 para isolar o caso, obteve ${m.score}`);
  assert.ok(!m.reasons.some((r) => r.key === "warn.addMisalign"), "eq=false não devia acionar warn.addMisalign");
  assert.strictEqual(m.classification, "safe", "sem a regra especial (só para eq!=false), um score alto deve classificar 'safe'");
});

/* ---------- qualidade de dados: len vs soma das secções ---------- */

test("len declarado != soma das secções dispara aviso (P0701)", () => {
  const rec = byId("P0701"); // len=480, soma=471
  const m = matchOne(fieldsOf(rec), rec);
  assert.ok(m.reasons.some((r) => r.key === "warn.lenSum"), "devia avisar sobre inconsistência de len");
});

/* ---------- direção desconhecida ---------- */

test("dirUnknown: self-match encontra-se a si próprio independente da direção declarada", () => {
  const rec = byId("P2601");
  const cm = computeMatches(fieldsOf(rec), true);
  const top = cm.results[0];
  assert.ok(top, "devia haver pelo menos um resultado");
  assert.strictEqual(top.score, 100);
});

test("dirUnknown não rebenta em nenhum registo do catálogo", () => {
  for (const rec of PECTAB_CATALOG) {
    assert.doesNotThrow(() => computeMatches(fieldsOf(rec), true), `${rec.id} rebentou em modo dirUnknown`);
  }
});

/* ---------- PECTAB fora de uso ---------- */

test("inUse=false nunca dá decisão 'use', mesmo em match exato (P0701)", () => {
  const rec = byId("P0701");
  const m = matchOne(fieldsOf(rec), rec);
  assert.strictEqual(m.classification, "exact");
  assert.strictEqual(decisionFor(m.classification, rec), "verify", "PECTAB fora de uso nunca deve dar luz verde");
});

test("sem candidato ativo equivalente, o próprio inativo (P0701) continua em 1º", () => {
  // este teste NÃO prova o desempate contra um ativo — só confirma que um
  // inativo sem concorrência continua visível em 1º (em vez de desaparecer).
  // o desempate real está no teste seguinte, com um par conhecido do
  // catálogo que colide mesmo.
  const rec = byId("P0701");
  const cm = computeMatches(fieldsOf(rec), false);
  const top = cm.results[0];
  assert.strictEqual(top.pectab.id, "P0701", "sem outro candidato, o próprio inativo deve ficar em 1º");
  assert.strictEqual(top.pectab.inUse, false);
});

test("inUse=false SÓ perde para um ativo com a MESMA especificação física (P9501 vs P8601)", () => {
  // par real do catálogo: P9501 (inUse=false) e P8601 (ativo) têm
  // dir/st/len/pax/main/add idênticos — uma medida que bate em P9501 bate
  // sempre também em P8601 com o mesmo score. Confirma a premissa antes de
  // testar o comportamento, para este teste nunca passar por acidente se
  // os dados do catálogo mudarem.
  const inactive = byId("P9501");
  const active = byId("P8601");
  const specOf = (r) => ({ dir: r.dir, st: r.st, len: r.len, pax: r.pax, main: r.main, add: r.add });
  assert.deepStrictEqual(specOf(inactive), specOf(active), "P9501/P8601 deixaram de ter a mesma especificação física — escolhe outro par no catálogo");
  assert.strictEqual(inactive.inUse, false);
  assert.notStrictEqual(active.inUse, false);

  const cm = computeMatches(fieldsOf(inactive), false); // self-match físico de P9501, que também bate em P8601
  const top = cm.results[0];
  assert.strictEqual(top.pectab.id, "P8601", "um candidato ATIVO com o mesmo score nunca deve perder para um fora de uso");
  assert.strictEqual(top.score, 100);
});

/* ---------- grupos fisicamente indistinguíveis ---------- */

test("grupo de duplicados conhecido (P0401/P0403/P0404/P0405) tem 4 membros", () => {
  const group = ["P0401", "P0403", "P0404", "P0405"].map(byId);
  const key = (r) => [r.dir, r.st, r.len, r.pax, r.main, r.add].join("|");
  const k0 = key(group[0]);
  assert.ok(
    group.every((r) => key(r) === k0),
    "os 4 registos deviam ter especificação física idêntica"
  );
});

/* ---------- fronteiras cumulativas (base do overlay do visualizador) ---------- */

test("cumulativeBoundaries soma corretamente as secções por ordem", () => {
  const rec = byId("P2601"); // ADD 11,11,11, MAIN 322, PAX 45 (add-first)
  const sections = sectionsFor(rec, "add-first");
  const bounds = cumulativeBoundaries(sections);
  const expected = [0, 11, 22, 33, 355, 400];
  // os arrays vêm de dois realms vm diferentes (sandbox vs. este script) —
  // deepStrictEqual falha a comparar protótipos entre realms mesmo com os
  // mesmos valores, por isso compara-se elemento a elemento.
  assert.strictEqual(bounds.length, expected.length, `tamanho diferente: ${JSON.stringify(bounds)}`);
  bounds.forEach((v, i) => assert.strictEqual(v, expected[i], `posição ${i}: esperado ${expected[i]}, obteve ${v}`));
});

/* ---------- catálogo completo: sem crashes, sem anomalias de decisão ---------- */

test("catálogo completo: 0 crashes, 0 anomalias inUse em computeMatches", () => {
  for (const rec of PECTAB_CATALOG) {
    const cm = computeMatches(fieldsOf(rec), false);
    const top = cm.results[0];
    if (!top) continue;
    if (top.pectab.inUse === false) {
      // só pode ficar em 1º se NENHUM candidato ativo também passou
      const hasActive = cm.results.some((r) => r.pectab.inUse !== false);
      assert.ok(!hasActive, `${rec.id}: candidato fora de uso ficou à frente de um ativo`);
    }
  }
});

/* ---------- relatório ---------- */

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : "\n  " + r.error}`);
}
console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
if (failed.length > 0) {
  process.exit(1);
}
