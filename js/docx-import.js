"use strict";
/* docx-import.js — preenche o formulário "Medida física" a partir de um
   .docx (um .zip com word/document.xml lá dentro). Lemos o zip à mão
   (formato simples: End Of Central Directory + Central Directory) e
   descomprimimos com a DecompressionStream nativa do browser — sem
   bibliotecas externas, para a app continuar a funcionar offline/file://. */

async function readDocxDocumentXml(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const EOCD_SIG = 0x06054b50;
  const CD_SIG = 0x02014b50;

  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557); // 22 (EOCD fixo) + comentário máx 65535
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error(t("docx.err.notValidZip"));

  const cdEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (view.getUint32(offset, true) !== CD_SIG) throw new Error(t("docx.err.corruptIndex"));
    const compMethod = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLen));

    if (name === "word/document.xml") {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compData = bytes.slice(dataStart, dataStart + compSize);

      let xmlBytes;
      if (compMethod === 0) {
        xmlBytes = compData;
      } else if (compMethod === 8) {
        if (typeof DecompressionStream === "undefined") {
          throw new Error(t("docx.err.noDecompression"));
        }
        const stream = new Blob([compData]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error(t("docx.err.unsupportedCompression", { method: compMethod }));
      }
      return new TextDecoder("utf-8").decode(xmlBytes);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(t("docx.err.documentXmlNotFound"));
}

function docxXmlToText(xml) {
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const lines = [];
  let para;
  while ((para = paraRe.exec(xml))) {
    let line = "";
    let t;
    textRe.lastIndex = 0;
    while ((t = textRe.exec(para[0]))) line += t[1];
    lines.push(
      line.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    );
  }
  return lines.join("\n");
}

function extractPhysicalFieldsFromText(text) {
  const found = {};
  const notes = [];

  // PECTABs só existem em mm inteiros — um formulário com decimais
  // (ex: "457.2") é arredondado, nunca aceite tal e qual.
  const roundMm = (value, label) => {
    if (value === null || isNaN(value)) return value;
    const rounded = Math.round(value);
    if (rounded !== value) notes.push(t("docx.roundedNote", { label, original: value, rounded }));
    return rounded;
  };

  const numAfterLabel = (labelRe) => {
    const m = text.match(new RegExp(labelRe + "\\s*(?:in\\s*mm)?\\s*[:=]\\s*([\\d.]+)", "i"));
    return m ? parseFloat(m[1]) : null;
  };

  found.len = roundMm(numAfterLabel("(?:bag\\s*tag\\s*length|total\\s*tag\\s*length)"), "len");
  found.pax = roundMm(numAfterLabel("(?:passenger\\s*stub\\s*length|pax\\s*stub\\s*length)"), "pax");
  found.main = roundMm(numAfterLabel("main\\s*tag\\s*(?:part\\s*)?length"), "main");

  const addMatch = text.match(/additional\s*stubs?\s*length\s*(?:in\s*mm)?\s*[:=]\s*([\d.]+(?:\s*&\s*[\d.]+)*)/i);
  const addVals = addMatch
    ? addMatch[1]
        .split("&")
        .map((s) => Math.round(parseFloat(s.trim())))
        .filter((v) => !isNaN(v))
    : [];

  // alguns formulários dizem "Additional Stubs length" mas dão a SOMA de
  // todos os talões, não o valor de cada um — e só desambiguam na frase
  // do nº de talões (ex: "3 Stubs each 15mm"). Essa frase, quando
  // existe, é inequívoca sobre o valor por talão — teve sempre prioridade
  // sobre a linha "length" (que pode ser total, soma, ou lista com "&").
  const eachStubMatch = text.match(/(\d+)\s*stubs?\s*each\s*([\d.]+)\s*mm/i);
  if (eachStubMatch) {
    const perStub = Math.round(parseFloat(eachStubMatch[2]));
    found.add = perStub;
    if (addVals.length === 1 && addVals[0] !== perStub) {
      notes.push(t("docx.totalVsPerStubNote", { total: addVals[0], count: eachStubMatch[1], perStub }));
    }
  } else if (addVals.length) {
    found.add = addVals[0];
    if (addVals.length > 1) {
      notes.push(t("docx.multiValueNote", { count: addVals.length, values: addVals.join(", "), first: addVals[0] }));
    }
  } else {
    found.add = null;
  }

  const stMatch =
    eachStubMatch ||
    text.match(/(?:how\s*many\s*additional\s*stubs|number\s*of\s*additional\s*stubs|n[ºo]\.?\s*of\s*additional\s*stubs)\s*[:=]?\s*(\d+)/i);
  found.st = stMatch ? parseInt(stMatch[1], 10) : null;

  const checkedRe = /[☒☑✓✔]/;
  const paxCheckbox = text.match(/pax\s*stub\s*([☐☑☒✓✔])/i);
  const addCheckbox = text.match(/additional\s*stubs\s*([☐☑☒✓✔])/i);
  if (paxCheckbox && checkedRe.test(paxCheckbox[1])) found.dir = "PAX";
  else if (addCheckbox && checkedRe.test(addCheckbox[1])) found.dir = "ADD";

  return { found, notes };
}

async function importDocxIntoPhysicalForm(file) {
  const statusHost = el("import-docx-status");
  try {
    const buf = await file.arrayBuffer();
    const xml = await readDocxDocumentXml(buf);
    const text = docxXmlToText(xml);
    const { found, notes } = extractPhysicalFieldsFromText(text);

    const applied = [];
    const missing = [];
    const setIfFound = (id, key) => {
      if (found[key] !== null && found[key] !== undefined && !isNaN(found[key])) {
        el(id).value = found[key];
        applied.push(`${key}=${found[key]}`);
      } else {
        missing.push(key);
      }
    };
    setIfFound("phys-len", "len");
    setIfFound("phys-pax", "pax");
    setIfFound("phys-main", "main");
    setIfFound("phys-add", "add");
    setIfFound("phys-st", "st");
    if (found.dir) {
      el("phys-dir").value = found.dir;
      applied.push(`dir=${found.dir}`);
    } else {
      missing.push("dir");
    }

    let msg = applied.length ? t("docx.applied", { list: applied.join(", ") }) : t("docx.noneDetected");
    if (missing.length) msg += t("docx.missing", { list: missing.join(", ") });
    statusHost.textContent = msg;
    if (notes.length) statusHost.textContent += " " + notes.join(" ");
    toast(missing.length ? t("docx.toast.withGaps") : t("docx.toast.success"));
  } catch (e) {
    statusHost.textContent = t("docx.importError", { error: e.message });
    toast(t("docx.toast.failure"));
  }
}
