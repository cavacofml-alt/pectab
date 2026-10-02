"use strict";
/* main.js — leitura dos formulários e init(): liga todos os event
   listeners da página. Carregado por último, depois de todos os outros
   ficheiros já terem definido o que init() precisa. */

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
    width: num("phys-width") || null, // opcional — só para o confronto com stocks da indústria, nunca entra no motor de matching
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
  applyStaticI18n();

  // primeira visita, sem nada guardado ainda: carrega o catálogo real
  // logo de início. Sem isto, procurar um match dá silenciosamente
  // "nenhum candidato" (base vazia) em vez de um erro óbvio — já
  // confundiu utilizadores a pensar que o botão de busca "não funciona".
  // clona os registos (não usa PECTAB_CATALOG por referência direta) —
  // sem isto, qualquer edição futura em state.db corrompia a própria
  // constante PECTAB_CATALOG, e "Carregar catálogo" deixava de detetar
  // diferenças (estaria a comparar o catálogo corrompido contra ele
  // próprio).
  if (state.db.length === 0) {
    state.db = PECTAB_CATALOG.map(clonePectab);
    saveDb(state.db);
  }

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
    if (!tr || !tr.dataset.id) return;
    state.selected = tr.dataset.id;
    renderDbList();
    renderVisualizer();
  });

  // (sem listener de clique no próprio hero-card: ele já mostra
  // state.selected, clicar lá dentro nunca muda esse valor — só
  // partia o toggle do <details> do score, porque um re-render a meio
  // do clique reconstrói o DOM e fecha-o outra vez no mesmo instante.)

  // botão de "escolher ficheiro" traduzível: o <input type="file"> nativo
  // mostra sempre o texto do browser/SO ("Choose File" / "Escolher
  // Ficheiro"), impossível de traduzir por CSS/HTML — escondemos o input
  // e usamos um botão + texto nossos, que só aciona o input por baixo.
  document.querySelectorAll(".file-picker-btn").forEach((btn) => {
    btn.addEventListener("click", () => el(btn.dataset.target).click());
  });
  document.querySelectorAll(".file-picker input[type=file]").forEach((input) => {
    input.addEventListener("change", () => {
      const nameEl = document.querySelector(`.file-picker-name[data-for="${input.id}"]`);
      if (!nameEl) return;
      if (input.files[0]) {
        nameEl.textContent = input.files[0].name;
        nameEl.removeAttribute("data-i18n");
      } else {
        nameEl.setAttribute("data-i18n", "file.noneChosen");
        nameEl.textContent = t("file.noneChosen");
      }
    });
  });

  el("candidates-list").addEventListener("click", (ev) => {
    const row = ev.target.closest(".candidate-row");
    if (!row) return;
    state.selected = row.dataset.id;
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

  // atualiza registos existentes (não só adiciona novos) — antes, carregar um
  // catálogo mais recente nunca substituía um ID já guardado localmente, por
  // isso uma correção nos dados nunca chegava a quem já tinha usado a app.
  function loadFromArray(recs, labelKey) {
    let added = 0;
    let updated = 0;
    for (const rec of recs) {
      const idx = state.db.findIndex((r) => r.id === rec.id);
      if (idx === -1) {
        state.db.push(clonePectab(rec));
        added++;
      } else if (JSON.stringify(state.db[idx]) !== JSON.stringify(rec)) {
        state.db[idx] = clonePectab(rec);
        updated++;
      }
    }
    commitDb();
    toast(t("toast.loadResultUpdated", { label: t(labelKey), added, updated }));
  }

  el("load-sample").addEventListener("click", () => loadFromArray(PECTAB_SAMPLE, "toast.label.sample"));
  el("load-catalog").addEventListener("click", () => loadFromArray(PECTAB_CATALOG, "toast.label.catalog"));

  el("catalog-search").addEventListener("input", (ev) => {
    state.catalogFilter.search = ev.target.value;
    renderDbList();
  });

  document.querySelectorAll(".catalog-dir-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogFilter.dir = btn.dataset.dir;
      document.querySelectorAll(".catalog-dir-filter").forEach((b) => b.classList.toggle("active", b === btn));
      renderDbList();
    });
  });

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

  el("tolerance-compare-wrap").addEventListener("click", (ev) => {
    if (!ev.target.closest("#apply-loose-tolerance-btn") || !state.toleranceCompare) return;
    el("phys-tolerance").value = state.toleranceCompare.tolerance;
    const advancedDetails = document.querySelector("details.advanced");
    if (advancedDetails) advancedDetails.open = true;
    const physical = readPhysicalForm();
    runMatching(physical);
    if (state.results.length > 0) state.selected = state.results[0].pectab.id;
    renderAll();
  });
  el("export-report-btn").addEventListener("click", exportValidationReport);
  el("export-history-csv-btn").addEventListener("click", exportHistoryCsv);

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
