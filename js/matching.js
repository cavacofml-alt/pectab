"use strict";
/* matching.js — o motor de comparação: confronto com stocks genéricos da
   indústria, pontuação/classificação de um candidato (matchOne), busca no
   catálogo (computeMatches/runMatching) e a decisão operacional final
   (decisionFor). Nenhuma função aqui toca no DOM. */

function checkIndustryStock(physical) {
  const notes = [];
  const w = INDUSTRY_STOCK_STANDARDS.widthMm;
  if (physical.width) {
    const inRange = physical.width >= w.min && physical.width <= w.max;
    notes.push({ key: inRange ? "stock.width.ok" : "stock.width.out", params: { width: physical.width, min: w.min, max: w.max }, ok: inRange });
  }
  // só nota positiva quando bate certo com um tamanho comercial conhecido — não bater
  // é o caso normal (a maioria dos PECTABs reais não é nenhum destes dois tamanhos),
  // nunca um aviso.
  const known = INDUSTRY_STOCK_STANDARDS.knownLengths.find((k) => k.lengthMm === physical.len);
  if (known) {
    notes.push({ key: "stock.length.knownMatch", params: { label: known.label, note: known.note }, ok: true });
  }
  return notes;
}

function sectionSum(rec) {
  // stubLengths[], quando existe, é a repartição real por talão (vem das
  // próprias remarks do catálogo, ex: "second stub is 20mm") — mais exata
  // do que assumir todos os talões iguais a "add" (só válido quando eq!=false).
  const addTotal = rec.stubLengths ? rec.stubLengths.reduce((sum, v) => sum + v, 0) : rec.st * rec.add;
  return rec.pax + rec.main + addTotal;
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

  // um desvio no "add" não fica isolado num talão — a perfuração física
  // repete-se a cada `st` talões com o MESMO espaçamento errado, por isso
  // o desalinhamento acumula: no pior caso (o último talão), o desvio
  // total é delta × st, não delta × st/2. Um PECTAB com 3 talões e o
  // "add" errado por 5mm não desalinha o 1º talão em 5mm — desalinha o
  // 3º em 15mm. O peso tem de refletir o pior caso, não a média.
  const addWeight = WEIGHTS.add * Math.max(1, rec.st);
  const breakdown = [
    { field: "pax", delta: deltas.pax, weight: WEIGHTS.pax, impact: -Math.abs(deltas.pax) * WEIGHTS.pax },
    { field: "main", delta: deltas.main, weight: WEIGHTS.main, impact: -Math.abs(deltas.main) * WEIGHTS.main },
    { field: "add", delta: deltas.add, weight: addWeight, impact: -Math.abs(deltas.add) * addWeight },
    { field: "len", delta: deltas.len, weight: WEIGHTS.len, impact: -Math.abs(deltas.len) * WEIGHTS.len },
  ];
  const penalty = -breakdown.reduce((sum, b) => sum + b.impact, 0);

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

  // um PECTAB com talões supostamente todos iguais (eq != false) mas cujo
  // "add" não bate certo vai desalinhar-se progressivamente a cada talão
  // adicional — visto em campo: a impressora não imprimiu o talão e o
  // 2º/3º saíram desalinhados, mesmo com pax/main/len praticamente
  // corretos. Por mais alto que o score dê, isto nunca é "seguro".
  if (classification === "safe" && rec.eq !== false && deltas.add !== 0 && rec.st > 1) {
    classification = "risky";
    reasons.push({ key: "warn.addMisalign", params: { delta: deltas.add, st: rec.st, worst: Math.abs(deltas.add * rec.st) } });
  }

  const declaredSum = sectionSum(rec);
  if (declaredSum !== rec.len) {
    reasons.push({ key: "warn.lenSum", params: { len: rec.len, sum: declaredSum, diff: Math.abs(declaredSum - rec.len) } });
  }
  if (rec.eq === false) {
    reasons.push(rec.stubLengths ? { key: "warn.eqNKnown", params: { values: rec.stubLengths.join("/") } } : { key: "warn.eqN" });
  }
  if (rec.inUse === false) {
    reasons.push({ key: "warn.notInUse" });
  }

  return { hardFail: false, score, classification, deltas, breakdown, reasons };
}

// dirUnknown=true: quando não se sabe qual secção sai primeiro da
// impressora, compara cada candidato usando a SUA PRÓPRIA direção — o
// "gate" de dir deixa de excluir seja quem for. Equivale a correr a busca
// uma vez para dir=PAX e outra para dir=ADD e juntar os resultados, mas
// sem duplicar código e sem mostrar exclusões por direção que não fazem
// sentido quando a direção é justamente o que não se sabe.
function computeMatches(physical, dirUnknown) {
  const results = [];
  const excluded = [];
  for (const rec of state.db) {
    const m = matchOne(dirUnknown ? { ...physical, dir: rec.dir } : physical, rec);
    if (m.hardFail) {
      excluded.push({ pectab: rec, reason: m.reason });
    } else {
      results.push({ pectab: rec, score: m.score, classification: m.classification, deltas: m.deltas, breakdown: m.breakdown, reasons: m.reasons });
    }
  }
  // um PECTAB fora de uso nunca deve aparecer à frente de um ativo, por
  // melhor que o score dê no papel — só entra à frente se não houver
  // nenhum candidato ativo disponível.
  results.sort((a, b) => {
    const aOut = a.pectab.inUse === false ? 1 : 0;
    const bOut = b.pectab.inUse === false ? 1 : 0;
    if (aOut !== bOut) return aOut - bOut;
    return b.score - a.score;
  });
  return { results, excluded };
}

function runMatching(physical) {
  const dirUnknown = physical.dir === "UNKNOWN";
  const { results, excluded } = computeMatches(physical, dirUnknown);
  state.results = results;
  state.excluded = excluded;
  state.lastPhysical = physical;
  state.dirUnknown = dirUnknown;

  // corre uma segunda busca com tolerância alargada (mesma lógica da nota
  // de campo: liner vs. etiqueta pode dar até 6mm) só para comparação —
  // não substitui a busca principal, só mostra se valer mesmo a pena
  // alargar (candidato diferente no topo).
  const looseTolerance = Math.max(physical.lenTolerance, EXTENDED_TOLERANCE_MM);
  if (looseTolerance > physical.lenTolerance) {
    const loose = computeMatches({ ...physical, lenTolerance: looseTolerance }, dirUnknown);
    const strictTopId = results[0] ? results[0].pectab.id : null;
    const looseTopId = loose.results[0] ? loose.results[0].pectab.id : null;
    state.toleranceCompare = looseTopId && looseTopId !== strictTopId ? { tolerance: looseTolerance, top: loose.results[0] } : null;
  } else {
    state.toleranceCompare = null;
  }
}

function decisionFor(classification, rec) {
  const base = DECISION_LEVEL[classification] || "verify";
  // uma medida exata não é a mesma pergunta que "isto ainda é o PECTAB
  // certo" — um PECTAB fora de uso nunca deve mostrar luz verde, por
  // melhor que as medidas batam certo por coincidência.
  if (base === "use" && rec && rec.inUse === false) return "verify";
  return base;
}
