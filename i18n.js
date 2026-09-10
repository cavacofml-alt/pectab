"use strict";

/* ---------- dicionário de traduções ---------- */
// Chaves usadas em data-i18n / data-i18n-html / data-i18n-title no HTML,
// e via t(key, vars) no app.js para texto gerado dinamicamente.
const I18N = {
  pt: {
    "app.subtitle": "Validação local de configurações PECTAB contra medidas físicas — sem servidor, dados no browser.",

    "panel.db.title": "Base de PECTABs (local)",
    "db.empty": "Base vazia. Carrega o catálogo real (ADD+PAX) ou adiciona um PECTAB abaixo.",
    "btn.loadCatalog": "Carregar catálogo (ADD+PAX)",
    "btn.loadSample": "Carregar exemplo fictício",
    "btn.exportDb": "Exportar base (JSON)",
    "btn.deleteSelected": "Apagar selecionado",

    "panel.addPectab.title": "Adicionar PECTAB",
    "label.id": "ID",
    "label.remarks": "remarks",
    "btn.addToDb": "Adicionar à base",

    "panel.import.title": "Importar",
    "label.jsonFile": "Ficheiro JSON",
    "label.orPasteJson": "ou cola JSON (array de PECTABs)",
    "btn.importJson": "Importar / atualizar",

    "panel.legend.title": "Como ler o teu formulário de medidas",
    "legend.intro": "Formulários de medição em inglês usam termos diferentes dos campos aqui. Equivalências mais comuns:",
    "legend.th.form": "No teu formulário (inglês)",
    "legend.th.field": "Campo aqui",
    "legend.row.width": "não usado — a ferramenta só trabalha o eixo do comprimento",
    "legend.row.paxChecked": '"Pax Stub" marcado como saindo primeiro',
    "legend.row.addChecked": '"Additional Stubs" marcado como saindo primeiro',
    "legend.multiValueNote.html":
      'Se o formulário listar <strong>mais do que um valor</strong> em "Additional Stub(s) length" (ex: "15 &amp; 10") os talões não são todos do mesmo tamanho — a ferramenta só aceita um valor de <code>add</code> por busca. Corre "Procurar match" uma vez por cada valor e compara os resultados.',
    "legend.toleranceNote.html":
      'O campo <code>tolerância len</code> não existe no teu formulário — é só desta ferramenta: quantos mm de diferença entre o teu <code>len</code> medido e o <code>len</code> de um PECTAB ainda são aceites antes de o excluir da lista. <code>0</code> = exige igual. <strong>Nota de campo:</strong> etiquetas medem-se por vezes pelo liner, por vezes pela própria etiqueta — isso sozinho já pode dar até 6mm de diferença (3mm de cada lado). Se uma busca estrita (tolerância 0) não encontrar nada bom, tenta 3-6mm antes de assumir que precisas de compilação nova. Isto só se aplica a <code>len</code>/<code>pax</code>/<code>main</code> — um desvio no <code>add</code> (talão) é outra história: desalinha-se e acumula a cada talão, não é "só medição".',

    "panel.physical.title": "Medida física (rolo testado)",
    "btn.importDocx": "Preencher a partir do .docx",
    "docx.statusDefault": "Deteção automática, best-effort — confirma sempre os valores antes de procurar match. Funciona offline, sem enviar o ficheiro para lado nenhum.",
    "label.tolerance": "tolerância len (mm)",
    "btn.searchMatch": "Procurar match",
    "btn.exportCompile": "Exportar pedido de compilação",

    "panel.results.title": "Candidatos",
    "excluded.summary": "Excluídos",

    "panel.viz.title": "Visualizador",
    "label.printOrder": "Ordem de impressão",
    "option.auto": "automática (por dir)",
    "option.paxFirst": "forçar PAX primeiro",
    "option.addFirst": "forçar ADD primeiro",
    "viz.legend.add": "ADD (talão)",
    "viz.legend.cutLines": "A/B = pontas da etiqueta · linha preta = corte entre secções",

    "panel.history.title": "Histórico de testes",
    "label.date": "Data",
    "label.airport": "Aeroporto/handler",
    "label.result": "Resultado",
    "option.ok": "OK",
    "option.fail": "Falhou",
    "label.note": "Nota",
    "btn.registerTest": "Registar teste",

    "field.dir.tooltip": "Qual secção sai primeiro da impressora: Pax Stub → PAX, Additional Stubs → ADD",
    "field.st.tooltip": "How many additional stubs — nº de talões adicionais",
    "field.len.tooltip": "Bag tag length — comprimento total da etiqueta",
    "field.pax.tooltip": "Passenger Stub length — comprimento do talão do passageiro",
    "field.main.tooltip": "Main tag part length — comprimento da parte principal",
    "field.add.tooltip.new": "Additional Stub(s) length — comprimento nominal de cada talão adicional",
    "field.add.tooltip.phys": "Additional Stub(s) length — comprimento de cada talão adicional. Se houver mais de um valor no formulário, corre uma busca por valor.",
    "field.eq.tooltip": "Se todos os talões adicionais têm o mesmo tamanho (N = tamanhos diferentes, add é só um valor nominal)",
    "field.dest.tooltip": "Nº de destinos que este PECTAB suporta (informativo)",
    "field.tolerance.tooltip": "Não vem do teu formulário — é só desta ferramenta. Quantos mm de diferença no len ainda são aceites antes de excluir um candidato. 0 = exige igual.",
    "field.eqBadge.title": "talões não são todos iguais",
    "field.notInUseBadge.title": "marcado como não estando atualmente em uso",
    "badge.notInUse": "fora de uso",
    "field.dir.label": "Direção de impressão",
    "option.dirPax": "PAX primeiro",
    "option.dirAdd": "ADD primeiro",
    "advanced.title": "Avançado (tolerância)",
    "btn.chooseFile": "Escolher ficheiro",
    "file.noneChosen": "Nenhum ficheiro escolhido",

    "zone.measure.title": "① MEDIR",
    "zone.match.title": "② RESULTADO DO MATCH",
    "zone.visual.title": "③ VALIDAÇÃO VISUAL",
    "zone.admin.title": "Administração (catálogo, importar, adicionar, histórico completo)",

    "hero.title.best": "MELHOR CANDIDATO",
    "hero.title.selected": "CANDIDATO SELECIONADO",
    "hero.subtitle": "{dir} · {st} talões · {len}mm",
    "hero.btnView": "Ver na validação visual ↓",

    "checklist.title": "Porque bate certo",
    "checklist.dir": "Direção",
    "checklist.st": "Nº de talões",
    "checklist.len": "Comprimento total",
    "checklist.pax": "Passageiro",
    "checklist.main": "Principal",
    "checklist.add": "Talão",

    "decision.use": "USAR PECTAB {id}",
    "decision.verify": "VERIFICAR ANTES DE USAR",
    "decision.dontuse": "NÃO USAR — PEDIR COMPILAÇÃO NOVA",

    "score.breakdown.title": "Ver como se calculou o score ({score})",
    "score.th.field": "Campo",
    "score.th.diff": "Diferença",
    "score.th.weight": "Peso",
    "score.th.impact": "Impacto",
    "score.final": "Score final: {score}",

    "compare.title": "Com tolerância alargada aparece um candidato diferente",
    "compare.strict": "Tolerância {tolerance}mm (a tua busca)",
    "compare.loose": "Tolerância alargada a {tolerance}mm",
    "compare.applyBtn": "Usar tolerância {tolerance}mm",

    "candidates.title": "Outros candidatos",
    "candidates.noneOther": "Não há outros candidatos.",
    "candidates.viewHint": "clica para veres na validação visual",

    "catalog.searchPlaceholder": "Procurar por ID…",
    "catalog.filter.all": "Todos",
    "catalog.count": "{shown} de {total} PECTABs mostrados",
    "catalog.noMatch": "Nenhum PECTAB corresponde à busca/filtro.",

    "history.table.title": "Histórico completo",
    "history.table.th.date": "Data",
    "history.table.th.pectab": "PECTAB",
    "history.table.th.result": "Resultado",
    "history.table.th.airport": "Aeroporto/handler",
    "history.table.th.note": "Nota",
    "history.table.empty": "Sem testes registados ainda.",
    "btn.exportHistoryCsv": "Exportar CSV",

    "btn.exportReport": "Gerar relatório de validação",
    "report.noCandidate": "Procura um match primeiro.",
    "report.title": "RELATÓRIO DE VALIDAÇÃO PECTAB",
    "report.generated": "Gerado: {date}",
    "report.pectabHeading": "PECTAB avaliado: {id}",
    "report.scoreBreakdown": "Cálculo do score:",
    "report.finalScore": "Score final: {score}",
    "report.warnings": "Avisos:",

    "class.exact": "Match exato",
    "class.safe": "Compromisso seguro",
    "class.risky": "Compromisso arriscado",
    "class.recompile": "Requer compilação nova",
    "classExplain.exact": "Medidas iguais em tudo. Podes usar sem receio.",
    "classExplain.safe": "Pequenas diferenças. Deve funcionar, mas confirma com um teste físico antes de imprimir em massa.",
    "classExplain.risky": "Diferenças consideráveis. Testa fisicamente antes de usar — pode desalinhar código de barras ou perfuração.",
    "classExplain.recompile": "Diferenças grandes demais para confiar. Provavelmente precisas de pedir uma compilação nova.",

    "field.label.pax": "Passageiro (pax)",
    "field.label.main": "Principal (main)",
    "field.label.add": "Talão (add)",
    "field.label.len": "Comprimento total (len)",
    "delta.equal": "{label}: igual ao que mediste",
    "delta.shorter": "{label}: {delta}mm mais curto no PECTAB do que mediste",
    "delta.longer": "{label}: {delta}mm mais comprido no PECTAB do que mediste",

    "fail.dir": "orientação diferente: mediste {measured}, este PECTAB é {rec}",
    "fail.st": "nº de talões diferente: mediste {measured}, este PECTAB tem {rec}",
    "fail.len": "comprimento total desvia {delta}mm (acima da tolerância de {tolerance}mm)",
    "warn.lenSum": "O len declarado deste PECTAB ({len}mm) não bate com a soma das suas secções ({sum}mm) — {diff}mm de inconsistência já no próprio registo, antes de comparar com a tua medida.",
    "warn.eqN": 'Este PECTAB tem talões de tamanhos diferentes (eq=N) — o valor "add" acima é só uma referência nominal, não representa cada talão.',
    "warn.addMisalign": "O talão (add) desvia {delta}mm — como se repete em {st} talões, o desalinhamento acumula: o último talão pode ficar {worst}mm fora do sítio. Visto em campo: talão sem imprimir e 2º/3º talão desalinhados. Nunca classificado como seguro só por causa disto — testa fisicamente antes de usar em produção.",
    "warn.notInUse": "Este PECTAB está marcado como não estando atualmente em uso, segundo quem gere os PECTABs — pode estar desatualizado ou ter sido substituído. Só aparece à frente de candidatos ativos se não houver nenhum disponível. Confirma antes de usar.",

    "results.empty.noSearch": 'Introduz as medidas físicas e clica em "Procurar match" para veres candidatos.',
    "results.empty.noCandidates": 'Nenhum candidato passou os filtros de exclusão. Ver secção "Excluídos" abaixo, ou exporta um pedido de compilação nova.',
    "excluded.empty": "Nenhum candidato excluído.",

    "viz.empty.noSelection": "Seleciona um PECTAB na lista ou nos resultados para o visualizar.",
    "viz.row.physical": "Físico (medido)",
    "viz.row.logical": "{id} (lógico)",
    "viz.summary.declaredLen": "len declarado ({id}): {len}mm",
    "viz.summary.sectionSum": "soma das secções ({id}): {sum}mm — {delta} face ao len declarado",
    "viz.summary.boundaryDelta": "{label}: {id} desvia {delta} do físico medido a partir daqui",
    "viz.summary.empty": "Sem desvios a assinalar.",
    "viz.boundary.end": "fim {section}",
    "viz.boundary.generic": "fronteira {n}",

    "history.empty.noSelection": "Seleciona um PECTAB para ver ou registar histórico de testes.",
    "history.empty.noTests": "Sem testes registados para este PECTAB.",
    "history.result.ok": "OK",
    "history.result.fail": "Falhou",
    "history.noLocation": "(sem local)",

    "compile.title": "PEDIDO DE COMPILAÇÃO PECTAB",
    "compile.generated": "Gerado: {date}",
    "compile.physicalHeading": "Medidas físicas (rolo testado):",
    "compile.bestCandidate": "Melhor candidato existente encontrado: {id} ({classification}, score {score})",
    "compile.notes": "Notas: {notes}",
    "compile.noneFound": "Nenhum candidato existente passou os filtros de exclusão.",
    "compile.requestedSpec": "Especificação pedida (a partir das medidas físicas acima):",

    "toast.needPhysicalFirst": "Introduz e procura uma medida física primeiro.",
    "toast.missingId": "Falta o ID do PECTAB.",
    "toast.duplicateId": "Já existe um PECTAB com id {id}.",
    "toast.added": "{id} adicionado.",
    "toast.loadResult": "{label}: {added} PECTAB(s) adicionados ({skipped} já existiam).",
    "toast.label.sample": "Exemplo fictício",
    "toast.label.catalog": "Catálogo real",
    "toast.invalidJsonArray": "esperado um array de PECTABs",
    "toast.importedUpdated": "{count} PECTAB(s) importados/atualizados.",
    "toast.invalidJson": "JSON inválido: {error}",
    "toast.chooseDocxFirst": "Escolhe primeiro um ficheiro .docx.",

    "docx.applied": "Preenchido: {list}.",
    "docx.noneDetected": "Não consegui detetar nenhum campo.",
    "docx.missing": " Não detetado (confirma à mão): {list}.",
    "docx.roundedNote": "{label}: {original}mm arredondado para {rounded}mm (PECTABs usam mm inteiros)",
    "docx.multiValueNote": "add: o formulário lista {count} valores ({values}mm) — os talões não são todos iguais. Usei {first}mm; corre o match outra vez com os outros valores.",
    "docx.totalVsPerStubNote": "add: \"Additional Stubs length\" ({total}mm) parece ser a soma dos {count} talões, não o valor de cada um — usei {perStub}mm (de \"each {perStub}mm\"). Confirma.",
    "docx.toast.withGaps": "Importado com lacunas — revê os campos assinalados.",
    "docx.toast.success": "Formulário preenchido a partir do .docx.",
    "docx.toast.failure": "Não consegui ler o .docx — preenche à mão.",
    "docx.importError": "Falha a importar: {error}",
    "docx.err.notValidZip": "não parece um .docx válido (fim de arquivo ZIP não encontrado)",
    "docx.err.corruptIndex": "índice do .docx corrompido",
    "docx.err.noDecompression": "este browser não suporta descompressão nativa (DecompressionStream) — atualiza o browser ou preenche o formulário à mão",
    "docx.err.unsupportedCompression": "método de compressão do .docx não suportado ({method})",
    "docx.err.documentXmlNotFound": "word/document.xml não encontrado dentro do .docx",
  },

  en: {
    "app.subtitle": "Local validation of PECTAB configurations against physical measurements — no server, data stays in your browser.",

    "panel.db.title": "PECTAB database (local)",
    "db.empty": "Empty database. Load the real catalog (ADD+PAX) or add a PECTAB below.",
    "btn.loadCatalog": "Load catalog (ADD+PAX)",
    "btn.loadSample": "Load fictional example",
    "btn.exportDb": "Export database (JSON)",
    "btn.deleteSelected": "Delete selected",

    "panel.addPectab.title": "Add PECTAB",
    "label.id": "ID",
    "label.remarks": "remarks",
    "btn.addToDb": "Add to database",

    "panel.import.title": "Import",
    "label.jsonFile": "JSON file",
    "label.orPasteJson": "or paste JSON (array of PECTABs)",
    "btn.importJson": "Import / update",

    "panel.legend.title": "How to read your measurement form",
    "legend.intro": "English measurement forms use different terms than the fields here. Most common equivalents:",
    "legend.th.form": "On your form (English)",
    "legend.th.field": "Field here",
    "legend.row.width": "not used — this tool only works the length axis",
    "legend.row.paxChecked": '"Pax Stub" checked as coming out first',
    "legend.row.addChecked": '"Additional Stubs" checked as coming out first',
    "legend.multiValueNote.html":
      'If the form lists <strong>more than one value</strong> for "Additional Stub(s) length" (e.g. "15 &amp; 10") the stubs aren\'t all the same size — this tool only takes one <code>add</code> value per search. Run "Search match" once per value and compare the results.',
    "legend.toleranceNote.html":
      'The <code>len tolerance</code> field has no equivalent on your form — it\'s a setting of this tool only: how many mm of difference between your measured <code>len</code> and a PECTAB\'s <code>len</code> are still accepted before excluding it from the list. <code>0</code> = requires an exact match. <strong>Field note:</strong> tags are sometimes measured by the liner, sometimes by the tag itself — that alone can account for up to 6mm of difference (3mm each side). If a strict search (tolerance 0) finds nothing good, try 3-6mm before assuming you need a new compile. This only applies to <code>len</code>/<code>pax</code>/<code>main</code> — a deviation in <code>add</code> (stub) is a different story: it misaligns and compounds with every stub, it\'s not "just measurement".',

    "panel.physical.title": "Physical measurement (tested roll)",
    "btn.importDocx": "Fill from .docx",
    "docx.statusDefault": "Automatic, best-effort detection — always confirm the values before searching for a match. Works offline, the file is never sent anywhere.",
    "label.tolerance": "len tolerance (mm)",
    "btn.searchMatch": "Search match",
    "btn.exportCompile": "Export compilation request",

    "panel.results.title": "Candidates",
    "excluded.summary": "Excluded",

    "panel.viz.title": "Visualizer",
    "label.printOrder": "Print order",
    "option.auto": "automatic (by dir)",
    "option.paxFirst": "force PAX first",
    "option.addFirst": "force ADD first",
    "viz.legend.add": "ADD (stub)",
    "viz.legend.cutLines": "A/B = tag ends · black line = cut between sections",

    "panel.history.title": "Test history",
    "label.date": "Date",
    "label.airport": "Airport/handler",
    "label.result": "Result",
    "option.ok": "OK",
    "option.fail": "Failed",
    "label.note": "Note",
    "btn.registerTest": "Register test",

    "field.dir.tooltip": "Which section prints first: Pax Stub → PAX, Additional Stubs → ADD",
    "field.st.tooltip": "How many additional stubs",
    "field.len.tooltip": "Bag tag length — total tag length",
    "field.pax.tooltip": "Passenger Stub length",
    "field.main.tooltip": "Main tag part length",
    "field.add.tooltip.new": "Additional Stub(s) length — nominal length of each additional stub",
    "field.add.tooltip.phys": "Additional Stub(s) length — length of each additional stub. If the form lists more than one value, run one search per value.",
    "field.eq.tooltip": "Whether all additional stubs are the same size (N = different sizes, add is just a nominal value)",
    "field.dest.tooltip": "Number of destinations this PECTAB supports (informational)",
    "field.tolerance.tooltip": "Not on your form — this is a setting of the tool itself. How many mm of len difference are still accepted before excluding a candidate. 0 = requires an exact match.",
    "field.eqBadge.title": "stubs are not all the same size",
    "field.notInUseBadge.title": "marked as not currently in use",
    "badge.notInUse": "not in use",
    "field.dir.label": "Print direction",
    "option.dirPax": "PAX first",
    "option.dirAdd": "ADD first",
    "advanced.title": "Advanced (tolerance)",
    "btn.chooseFile": "Choose file",
    "file.noneChosen": "No file chosen",

    "zone.measure.title": "① MEASURE",
    "zone.match.title": "② MATCH RESULT",
    "zone.visual.title": "③ VISUAL VALIDATION",
    "zone.admin.title": "Admin (catalog, import, add, full history)",

    "hero.title.best": "BEST MATCH",
    "hero.title.selected": "SELECTED CANDIDATE",
    "hero.subtitle": "{dir} · {st} stubs · {len}mm",
    "hero.btnView": "View in visual validation ↓",

    "checklist.title": "Why this matches",
    "checklist.dir": "Direction",
    "checklist.st": "Stub count",
    "checklist.len": "Total length",
    "checklist.pax": "Passenger",
    "checklist.main": "Main",
    "checklist.add": "Stub",

    "decision.use": "USE PECTAB {id}",
    "decision.verify": "VERIFY BEFORE USE",
    "decision.dontuse": "DO NOT USE — RECOMPILE REQUIRED",

    "score.breakdown.title": "See how the score ({score}) was calculated",
    "score.th.field": "Field",
    "score.th.diff": "Difference",
    "score.th.weight": "Weight",
    "score.th.impact": "Impact",
    "score.final": "Final score: {score}",

    "compare.title": "A wider tolerance surfaces a different candidate",
    "compare.strict": "{tolerance}mm tolerance (your search)",
    "compare.loose": "Widened to {tolerance}mm tolerance",
    "compare.applyBtn": "Use {tolerance}mm tolerance",

    "candidates.title": "Other candidates",
    "candidates.noneOther": "No other candidates.",
    "candidates.viewHint": "click to view in visual validation",

    "catalog.searchPlaceholder": "Search by ID…",
    "catalog.filter.all": "All",
    "catalog.count": "{shown} of {total} PECTABs shown",
    "catalog.noMatch": "No PECTAB matches the search/filter.",

    "history.table.title": "Full history",
    "history.table.th.date": "Date",
    "history.table.th.pectab": "PECTAB",
    "history.table.th.result": "Result",
    "history.table.th.airport": "Airport/handler",
    "history.table.th.note": "Note",
    "history.table.empty": "No tests logged yet.",
    "btn.exportHistoryCsv": "Export CSV",

    "btn.exportReport": "Generate validation report",
    "report.noCandidate": "Search for a match first.",
    "report.title": "PECTAB VALIDATION REPORT",
    "report.generated": "Generated: {date}",
    "report.pectabHeading": "PECTAB evaluated: {id}",
    "report.scoreBreakdown": "Score calculation:",
    "report.finalScore": "Final score: {score}",
    "report.warnings": "Warnings:",

    "class.exact": "Exact match",
    "class.safe": "Safe compromise",
    "class.risky": "Risky compromise",
    "class.recompile": "Needs a new compile",
    "classExplain.exact": "Every measurement matches. Safe to use.",
    "classExplain.safe": "Small differences. Should work, but confirm with a physical test before printing in bulk.",
    "classExplain.risky": "Considerable differences. Test physically before using — barcode or perforation may misalign.",
    "classExplain.recompile": "Differences too large to trust. You probably need to request a new compile.",

    "field.label.pax": "Passenger (pax)",
    "field.label.main": "Main",
    "field.label.add": "Stub (add)",
    "field.label.len": "Total length (len)",
    "delta.equal": "{label}: matches what you measured",
    "delta.shorter": "{label}: {delta}mm shorter on the PECTAB than what you measured",
    "delta.longer": "{label}: {delta}mm longer on the PECTAB than what you measured",

    "fail.dir": "different orientation: you measured {measured}, this PECTAB is {rec}",
    "fail.st": "different stub count: you measured {measured}, this PECTAB has {rec}",
    "fail.len": "total length deviates {delta}mm (above the {tolerance}mm tolerance)",
    "warn.lenSum": "This PECTAB's declared len ({len}mm) doesn't match the sum of its sections ({sum}mm) — {diff}mm of inconsistency already in the record itself, before comparing to your measurement.",
    "warn.eqN": 'This PECTAB has additional stubs of different sizes (eq=N) — the "add" value above is only a nominal reference, not each individual stub.',
    "warn.addMisalign": "The stub (add) deviates {delta}mm — since it repeats over {st} stubs, the misalignment compounds: the last stub can end up {worst}mm off. Seen in the field: a stub not printing at all, and the 2nd/3rd stub misaligned. Never classified as safe just from a small add mismatch — test physically before using in production.",
    "warn.notInUse": "This PECTAB is marked as not currently in use by whoever manages the PECTABs — it may be outdated or have been replaced. Only ranks above active candidates when none are available. Confirm before using.",

    "results.empty.noSearch": 'Enter the physical measurements and click "Search match" to see candidates.',
    "results.empty.noCandidates": 'No candidate passed the exclusion filters. See the "Excluded" section below, or export a new compilation request.',
    "excluded.empty": "No candidate excluded.",

    "viz.empty.noSelection": "Select a PECTAB in the list or in the results to visualize it.",
    "viz.row.physical": "Physical (measured)",
    "viz.row.logical": "{id} (logical)",
    "viz.summary.declaredLen": "declared len ({id}): {len}mm",
    "viz.summary.sectionSum": "section sum ({id}): {sum}mm — {delta} vs. declared len",
    "viz.summary.boundaryDelta": "{label}: {id} deviates {delta} from the physical measurement from here on",
    "viz.summary.empty": "No deviations to flag.",
    "viz.boundary.end": "end of {section}",
    "viz.boundary.generic": "boundary {n}",

    "history.empty.noSelection": "Select a PECTAB to see or log test history.",
    "history.empty.noTests": "No tests logged for this PECTAB.",
    "history.result.ok": "OK",
    "history.result.fail": "Failed",
    "history.noLocation": "(no location)",

    "compile.title": "PECTAB COMPILATION REQUEST",
    "compile.generated": "Generated: {date}",
    "compile.physicalHeading": "Physical measurements (tested roll):",
    "compile.bestCandidate": "Best existing candidate found: {id} ({classification}, score {score})",
    "compile.notes": "Notes: {notes}",
    "compile.noneFound": "No existing candidate passed the exclusion filters.",
    "compile.requestedSpec": "Requested spec (from the physical measurements above):",

    "toast.needPhysicalFirst": "Enter and search a physical measurement first.",
    "toast.missingId": "Missing PECTAB ID.",
    "toast.duplicateId": "A PECTAB with id {id} already exists.",
    "toast.added": "{id} added.",
    "toast.loadResult": "{label}: {added} PECTAB(s) added ({skipped} already existed).",
    "toast.label.sample": "Fictional example",
    "toast.label.catalog": "Real catalog",
    "toast.invalidJsonArray": "expected an array of PECTABs",
    "toast.importedUpdated": "{count} PECTAB(s) imported/updated.",
    "toast.invalidJson": "Invalid JSON: {error}",
    "toast.chooseDocxFirst": "Choose a .docx file first.",

    "docx.applied": "Filled: {list}.",
    "docx.noneDetected": "Couldn't detect any field.",
    "docx.missing": " Not detected (check by hand): {list}.",
    "docx.roundedNote": "{label}: {original}mm rounded to {rounded}mm (PECTABs use whole mm)",
    "docx.multiValueNote": "add: the form lists {count} values ({values}mm) — the stubs aren't all the same size. Used {first}mm; run the match again with the other value(s).",
    "docx.totalVsPerStubNote": "add: \"Additional Stubs length\" ({total}mm) looks like the sum of the {count} stubs, not each one's own length — used {perStub}mm (from \"each {perStub}mm\"). Please confirm.",
    "docx.toast.withGaps": "Imported with gaps — review the flagged fields.",
    "docx.toast.success": "Form filled from the .docx.",
    "docx.toast.failure": "Couldn't read the .docx — fill in by hand.",
    "docx.importError": "Import failed: {error}",
    "docx.err.notValidZip": "doesn't look like a valid .docx (ZIP end marker not found)",
    "docx.err.corruptIndex": "corrupt .docx index",
    "docx.err.noDecompression": "this browser doesn't support native decompression (DecompressionStream) — update your browser or fill the form by hand",
    "docx.err.unsupportedCompression": "unsupported .docx compression method ({method})",
    "docx.err.documentXmlNotFound": "word/document.xml not found inside the .docx",
  },
};

const LANG_STORAGE = "pectab.lang";

function getLang() {
  const stored = localStorage.getItem(LANG_STORAGE);
  return stored === "en" || stored === "pt" ? stored : "pt";
}

function setLang(lang) {
  localStorage.setItem(LANG_STORAGE, lang);
}

function t(key, vars) {
  const dict = I18N[getLang()] || I18N.pt;
  let str = dict[key] !== undefined ? dict[key] : I18N.pt[key];
  if (str === undefined) return key;
  if (vars) {
    for (const k in vars) str = str.split(`{${k}}`).join(vars[k]);
  }
  return str;
}

function applyStaticI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    node.innerHTML = t(node.getAttribute("data-i18n-html"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.title = t(node.getAttribute("data-i18n-title"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.getAttribute("data-i18n-placeholder"));
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === getLang());
  });
}
