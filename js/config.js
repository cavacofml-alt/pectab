"use strict";
/* config.js — chaves de armazenamento, afinações do motor de matching,
   padrões genéricos da indústria, e os mapas de cor/decisão usados pelo
   resto da app. Sem lógica, só valores — carregado primeiro. */

/* ---------- tuning knobs (ajusta à experiência de campo) ---------- */
const LEN_TOLERANCE_DEFAULT = 0; // mm — acima disto, len é hard fail
const WEIGHTS = { pax: 1.0, main: 1.2, add: 1.5, len: 0.8 };
const SAFE_THRESHOLD = 90; // score >= isto => "compromisso seguro"
const RISK_THRESHOLD = 60; // score >= isto => "compromisso arriscado"
const VIZ_RISK_MM = 3; // desvio de fronteira (mm) a partir do qual o visualizador marca a vermelho
const EXTENDED_TOLERANCE_MM = 6; // tolerância "alargada" usada para a comparação automática — etiquetas medidas pelo liner vs. pela própria etiqueta podem variar até isto

const STORAGE_DB = "pectab.db";
const STORAGE_HISTORY = "pectab.history";

/* ---------- stocks conhecidos da indústria (referência genérica, não específica de nenhum cliente) ----------
   Isto NÃO é o catálogo de PECTABs (esse vem de quem gere e cria os
   PECTABs, é a fonte autoritativa). Isto é um segundo sinal, genérico,
   para quando se recebe uma medida de um cliente/fornecedor de
   impressão e se quer confirmar se está dentro do que é fisicamente
   normal na indústria — nunca substitui o catálogo.

   Fontes verificadas em debate cruzado entre dois modelos de IA
   (cada um a corrigir e a testar o outro, incluindo dois casos em que
   um deles admitiu ter inventado um detalhe específico — o "635mm/
   Unimark/Zebra" e o "Attachment G com duas orientações nomeadas" —
   e foi corrigido). Documentos primários (iata.org, scribd, sites de
   fabricantes) continuam bloqueados pela rede deste ambiente — nunca
   verificados diretamente por nós, só por convergência entre fontes
   independentes. Ver README para o histórico completo do debate.

   Deliberadamente SEM intervalo de comprimento "típico": chegámos a
   ter um (400-600mm, de fichas técnicas Epson/Urielsoft), mas
   descartámo-lo — daria um falso aviso num PECTAB real e válido do
   nosso próprio catálogo (P5401, 350mm, talão único), que está bem
   dentro do intervalo de impressoras móveis de bag tag documentado
   pela Zebra (12,7-813mm — intervalo demasiado largo para distinguir
   "normal" de "estranho", por isso nem esse usamos como aviso). */
const INDUSTRY_STOCK_STANDARDS = {
  widthMm: { min: 50.8, max: 54.0, source: "IATA Resolution 740, Attachments S1/T — convergência entre duas pesquisas de IA independentes, doc. primário não acedido diretamente" },
  knownLengths: [
    { label: '2" × 21" (51mm × 533,4mm)', lengthMm: 533, note: "tamanho comercial confirmado (página de produto real, Panda Paper Roll) — não é um comprimento definido pela IATA, é só um tamanho que se vende", source: "pandapaperroll.com" },
    { label: '2,125" × 21,25" (54mm × 540mm)', lengthMm: 540, note: "pelo menos um fornecedor vende este tamanho — menos bem triangulado entre fontes do que o de 533,4mm, trata com um pouco mais de cautela", source: "pandapaperroll.com" },
  ],
};

const TYPE_COLOR = { MAIN: "#FFC000", PAX: "#00B050", ADD: "#00B0F0" };
const TYPE_TEXT_COLOR = { MAIN: "#3a2e00", PAX: "#fff", ADD: "#00303f" };

// classificação técnica (exact/safe/risky/recompile) -> decisão operacional
// de 3 níveis, para a resposta "posso usar ou não" nunca ficar ambígua.
const DECISION_LEVEL = { exact: "use", safe: "use", risky: "verify", recompile: "dontuse" };
const DECISION_ICON = { use: "🟢", verify: "🟡", dontuse: "🔴" };
