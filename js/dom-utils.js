"use strict";
/* dom-utils.js — pequenos utilitários partilhados por todos os renderers:
   acesso a elementos, formatação de texto/números, escape de HTML,
   download de ficheiros e os toasts. */

const el = (id) => document.getElementById(id);

function classLabel(c) {
  return t(`class.${c}`);
}

function classExplain(c) {
  return t(`classExplain.${c}`);
}

function fieldLabel(field) {
  return t(`field.label.${field}`);
}

// frase legível para um desvio: delta = medido - PECTAB. positivo => PECTAB mais curto nesse campo.
function deltaPhrase(field, delta) {
  const label = fieldLabel(field);
  if (delta === 0) return t("delta.equal", { label });
  if (delta > 0) return t("delta.shorter", { label, delta: Math.abs(delta) });
  return t("delta.longer", { label, delta: Math.abs(delta) });
}

function fmtDelta(v) {
  if (v === 0) return "0mm";
  return (v > 0 ? "+" : "") + v + "mm";
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
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
// cada chamada empilha um toast novo (em vez de reutilizar sempre a
// mesma div) — duas ações rápidas seguidas mostram as duas mensagens,
// não só a última a sobrepor-se à primeira.
function toast(msg) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = msg;
  stack.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}
