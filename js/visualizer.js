"use strict";
/* visualizer.js — o SVG de comparação física: ordem das secções de um
   PECTAB (sectionsFor), desenho da barra de referência (renderBar), a
   sobreposição dos limites medidos (renderBoundaryOverlay) e a função de
   topo que monta o SVG todo (renderVisualizer). */

function sectionsFor(rec, orderMode) {
  const mode = orderMode || (rec.dir === "ADD" ? "add-first" : "pax-first");
  // com stubLengths[] desenha cada talão com o seu comprimento real, em vez
  // de repetir "add" (só uma média/nominal quando eq=false) para todos.
  const stubs = Array.from({ length: rec.st }, (_, i) => ({ type: "ADD", label: `ADD${i + 1}`, len: rec.stubLengths ? rec.stubLengths[i] : rec.add }));
  const pax = { type: "PAX", label: "PAX", len: rec.pax };
  const main = { type: "MAIN", label: "MAIN", len: rec.main };
  return mode === "add-first" ? [...stubs, main, pax] : [pax, main, ...stubs];
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
  const marginX = 30; // dá espaço aos furos + letras A/B fora da barra
  const width = Math.ceil(totalMm * pxPerMm) + marginX * 2;
  // só UMA barra agora (a do PECTAB, é a referência) — a medida física
  // sobrepõe-se a ela em vez de ocupar uma segunda linha separada. Reserva
  // espaço por cima (chavetas de talões agrupados + bandeiras dos limites
  // físicos) e por baixo (rótulos "Δ Xmm" dos desvios).
  const y0 = 60;
  const height = y0 + barH + 56;

  // width="100%" sem height fixo: o SVG encolhe sempre para caber na
  // largura do painel (nunca pede scroll horizontal) e a altura
  // acompanha proporcionalmente — sem distorcer texto, ao contrário de
  // esticar só o eixo x.
  let svg = `<svg width="100%" viewBox="0 0 ${width} ${height}" style="display:block">`;

  svg += renderBar(recSections, marginX, y0, pxPerMm, barH, physical ? t("viz.row.overlay", { id: rec.id }) : t("viz.row.logical", { id: rec.id }));

  // linha do len declarado: vermelho é "chama a atenção, há um problema" —
  // só faz sentido aqui quando o len realmente não bate com a soma das
  // secções (a mesma condição que já desenha a linha âmbar abaixo). Quando
  // bate certo, esta linha coincide com a própria borda da barra — fica
  // discreta, não compete visualmente com um desvio real.
  const sum = sectionSum(rec);
  const lenX = marginX + rec.len * pxPerMm;
  const lenLineColor = sum !== rec.len ? "#cf222e" : "#999";
  svg += `<line x1="${lenX}" y1="10" x2="${lenX}" y2="${height - 10}" stroke="${lenLineColor}" stroke-dasharray="4,3" stroke-width="1.5" opacity="${sum !== rec.len ? 1 : 0.4}"/>`;

  const summaryLines = [];
  summaryLines.push(`<span style="color:${lenLineColor}">┃</span> ${t("viz.summary.declaredLen", { id: rec.id, len: rec.len })}`);

  if (sum !== rec.len) {
    const sumX = marginX + sum * pxPerMm;
    svg += `<line x1="${sumX}" y1="10" x2="${sumX}" y2="${height - 10}" stroke="#9a6700" stroke-dasharray="2,2" stroke-width="1.5"/>`;
    summaryLines.push(
      `<span style="color:#9a6700">┊</span> ${t("viz.summary.sectionSum", { id: rec.id, sum, delta: fmtDelta(sum - rec.len) })}`
    );
  }

  // sobrepõe os limites da medida física em cima da MESMA barra do PECTAB —
  // alinhados, quase não se notam; desviados, saltam à vista a vermelho.
  if (physical) {
    const { markup, deltas } = renderBoundaryOverlay(physSections, recSections, pxPerMm, y0, barH, marginX);
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

  const positioned = sections.map((s) => {
    const w = Math.max(1, s.len * pxPerMm);
    const sx = x;
    x += w;
    return { s, x: sx, w };
  });

  for (const { s, x: sx, w } of positioned) {
    out += `<rect x="${sx}" y="${y0}" width="${w}" height="${h}" fill="${TYPE_COLOR[s.type]}"/>`;
  }

  // legendas: por secção quando há espaço; secções seguidas do mesmo tipo e
  // comprimento (ex: 3 talões ADD todos a 11mm) que não têm espaço nenhum
  // para texto individual ganham uma chaveta só por cima do grupo, em vez
  // de ficarem todas sem legenda nenhuma.
  let i = 0;
  while (i < positioned.length) {
    let j = i;
    while (j + 1 < positioned.length && positioned[j + 1].s.type === positioned[i].s.type && positioned[j + 1].s.len === positioned[i].s.len) j++;
    const run = positioned.slice(i, j + 1);
    const anyFits = run.some(({ s, w }) => w >= s.label.length * 6 + 4);
    if (anyFits || run.length === 1) {
      for (const { s, x: sx, w } of run) {
        const dims = `${s.label} ${s.len}mm`;
        if (w >= dims.length * 5.5 + 4) {
          out += `<text x="${sx + w / 2}" y="${y0 + h / 2 + 3}" fill="${TYPE_TEXT_COLOR[s.type]}" font-size="9" text-anchor="middle">${dims}</text>`;
        } else if (w >= s.label.length * 6 + 4) {
          out += `<text x="${sx + w / 2}" y="${y0 + h / 2 + 3}" fill="${TYPE_TEXT_COLOR[s.type]}" font-size="9" text-anchor="middle">${s.label}</text>`;
        }
      }
    } else {
      const groupX0 = run[0].x;
      const groupX1 = run[run.length - 1].x + run[run.length - 1].w;
      const bracketY = y0 - 14;
      out += `<line x1="${groupX0}" y1="${bracketY}" x2="${groupX0}" y2="${y0}" stroke="#666" stroke-width="1"/>`;
      out += `<line x1="${groupX1}" y1="${bracketY}" x2="${groupX1}" y2="${y0}" stroke="#666" stroke-width="1"/>`;
      out += `<line x1="${groupX0}" y1="${bracketY}" x2="${groupX1}" y2="${bracketY}" stroke="#666" stroke-width="1"/>`;
      out += `<text x="${(groupX0 + groupX1) / 2}" y="${bracketY - 4}" font-size="9" text-anchor="middle">${run.length} × ${run[0].s.type} ${run[0].s.len}mm</text>`;
    }
    i = j + 1;
  }

  // linhas de corte entre secções (não são desvios, são cortes reais da etiqueta)
  let cutX = x0;
  for (let k = 0; k < sections.length - 1; k++) {
    cutX += sections[k].len * pxPerMm;
    out += `<line x1="${cutX}" y1="${y0}" x2="${cutX}" y2="${y0 + h}" stroke="#000" stroke-width="1"/>`;
  }

  out += `<rect x="${x0}" y="${y0}" width="${x - x0}" height="${h}" fill="none" stroke="#333" stroke-width="1"/>`;

  // furos junto às pontas, como numa etiqueta física real
  out += `<ellipse cx="${x0 - 14}" cy="${y0 + h / 2}" rx="4" ry="7" fill="none" stroke="#999" stroke-width="1.2"/>`;
  out += `<ellipse cx="${x + 14}" cy="${y0 + h / 2}" rx="4" ry="7" fill="none" stroke="#999" stroke-width="1.2"/>`;

  out += `<text x="${x0 - 22}" y="${y0 + h / 2 + 4}" text-anchor="end" font-weight="bold">A</text>`;
  out += `<text x="${x + 22}" y="${y0 + h / 2 + 4}" text-anchor="start" font-weight="bold">B</text>`;
  return out;
}

// desenha os limites da medida física sobrepostos à barra do PECTAB (a
// referência): alinhados, uma linha cinzenta quase invisível por cima do
// corte que já lá está; desviados, uma linha vermelha mais grossa + uma
// faixa sombreada a preencher o espaço entre o corte esperado e o medido
// + o desvio em mm por baixo da barra. O olho só é puxado para onde há
// mesmo um problema — um limite certo não compete visualmente com um errado.
function renderBoundaryOverlay(physSections, recSections, pxPerMm, y0, barH, marginX) {
  const physBoundaries = cumulativeBoundaries(physSections);
  const recBoundaries = cumulativeBoundaries(recSections);
  const n = Math.min(physBoundaries.length, recBoundaries.length) - 1; // ignora a fronteira final (=len total, já tem a sua própria linha)
  let markup = "";
  const deltas = [];
  let prevDelta = 0;
  let prevIncrement = null;
  const flagTop = y0 - 8;
  const labelY = y0 + barH + 16;
  for (let i = 1; i < n; i++) {
    const delta = recBoundaries[i] - physBoundaries[i];
    const increment = delta - prevDelta;
    // um talão mais curto/comprido do que devia arrasta o mesmo desvio
    // constante fronteira a fronteira (ex: -5mm, -10mm, -15mm em 3 talões
    // iguais) — isso é UM problema a repetir-se, não três. Só assinala
    // quando o ritmo do desvio muda, não sempre que o desvio acumulado
    // cresce da mesma forma.
    const isNewPattern = prevIncrement === null || Math.abs(increment - prevIncrement) >= 1;
    const recX = marginX + recBoundaries[i] * pxPerMm;
    const physX = marginX + physBoundaries[i] * pxPerMm;
    const isOff = Math.abs(delta) >= VIZ_RISK_MM && isNewPattern;

    if (isOff) {
      const lo = Math.min(recX, physX);
      const hi = Math.max(recX, physX);
      markup += `<rect x="${lo}" y="${y0}" width="${Math.max(1, hi - lo)}" height="${barH}" fill="#cf222e" opacity="0.18"/>`;
      markup += `<line x1="${physX}" y1="${flagTop}" x2="${physX}" y2="${y0 + barH + 6}" stroke="#cf222e" stroke-width="2" stroke-dasharray="4,2"/>`;
      markup += `<text x="${physX}" y="${labelY}" font-size="10" font-weight="700" fill="#cf222e" text-anchor="middle">Δ${fmtDelta(delta)}</text>`;
      const label = physSections[i - 1] ? t("viz.boundary.end", { section: physSections[i - 1].label }) : t("viz.boundary.generic", { n: i });
      deltas.push({ label, delta });
    } else {
      // coincidente (ou desvio pequeno demais para interessar): traço
      // discreto, semi-transparente, mesmo em cima do corte do PECTAB —
      // confirma que ali está tudo bem sem chamar a atenção para isso.
      markup += `<line x1="${physX}" y1="${y0 - 2}" x2="${physX}" y2="${y0 + barH + 2}" stroke="#666" stroke-width="1" stroke-dasharray="3,2" opacity="0.35"/>`;
    }
    prevIncrement = increment;
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
