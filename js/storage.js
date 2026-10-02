"use strict";
/* storage.js — persistência em localStorage (base de PECTABs + histórico),
   tolerante a falhas (ver comentário em saveDb). */

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_DB);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Falha a ler base local, a começar vazia.", e);
    return [];
  }
}

function saveDb(db) {
  // sob file://, alguns browsers (Edge com certas políticas de segurança
  // para ficheiros locais, entre outros) bloqueiam o localStorage e
  // localStorage.setItem lança excepção. Se isto disparar sem apanhar
  // dentro do init(), o resto do arranque (incluindo ligar o botão
  // "Procurar match") nunca chega a correr — a app persistir os dados
  // é sempre secundário a ela funcionar, mesmo que não persista nada.
  try {
    localStorage.setItem(STORAGE_DB, JSON.stringify(db));
  } catch (e) {
    console.error("Falha a guardar base local — a app continua a funcionar, só sem persistência.", e);
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Falha a ler histórico local, a começar vazio.", e);
    return {};
  }
}

function saveHistory(hist) {
  try {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(hist));
  } catch (e) {
    console.error("Falha a guardar histórico local — a app continua a funcionar, só sem persistência.", e);
  }
}
