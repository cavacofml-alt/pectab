# PECTAB Toolkit

Ferramenta local, sem backend, para validar e comparar configurações PECTAB
(etiquetas de bagagem) contra medidas físicas de papel, antes de as testar
numa impressora real.

Nasceu de um problema recorrente em auditorias de aeroporto: escolher um
PECTAB existente no DCS às cegas, imprimir, e só descobrir em papel que o
`len` declarado não bate com a soma das secções, ou que a fronteira
stub/main não coincide com a perfuração física do rolo.

## Porque não é uma app com backend

A app não tem servidor, base de dados hospedada nem passo de build de
propósito: o uso real é junto à impressora, em redes de aeroporto
frequentemente fechadas ou sem internet. Tudo corre no browser, os dados
ficam no `localStorage` da máquina, e o ficheiro `index.html` pode andar
numa pen. Isto foi uma escolha deliberada — ver a discussão que motivou
este projeto para a comparação com uma stack Next.js/FastAPI/Postgres.

## Como correr

Não há passo de instalação nem servidor necessário. Abre `index.html`
diretamente no browser — duplo clique funciona, incluindo os botões de
carregar catálogo. Os dados (`data/pectabs.json` e
`data/sample-pectabs.json`) vêm embutidos em `data.js`, carregado antes
de `app.js`, exatamente para evitar o bloqueio de CORS que o Chrome/Edge
aplica a `fetch()` de ficheiros locais quando a página é aberta como
`file://`.

## Modelo de dados

Um PECTAB é um registo com:

- `id` — identificador (ex: `P6301`)
- `dir` — `PAX` ou `ADD`, ordem de impressão das secções
- `st` — número de talões adicionais (bingo stubs)
- `len` — comprimento total declarado (mm)
- `pax` — comprimento da secção do passageiro (mm)
- `main` — comprimento da secção principal/código de barras (mm)
- `add` — comprimento de cada talão adicional (mm)
- `eq` — booleano, se todos os talões adicionais têm o mesmo tamanho
  (quando `false`, o campo `add` é só um valor nominal — o export não dá
  o tamanho individual de cada talão, por isso o visualizador não
  consegue desenhar isso com exatidão; a app mostra um aviso nesse caso)
- `dest` — nº de destinos que o PECTAB suporta (informativo)
- `remarks` — texto livre

A "medida física" introduzida no formulário de matching usa exatamente os
mesmos campos — mede-se o rolo com uma régua e preenche-se da mesma forma
que um PECTAB, para que a comparação seja direta.

### Ordem de impressão das secções

Isto é uma **assunção**, não um facto confirmado a partir de exports reais
do DCS — verifica contra o que vês fisicamente e ajusta o interruptor
"Ordem de impressão" no visualizador se estiver ao contrário:

- `dir = PAX` → assume-se `[PAX, MAIN, ADD×st]`
- `dir = ADD` → assume-se `[ADD×st, MAIN, PAX]`

## Motor de matching

Para cada PECTAB na base local, comparado contra a medida física:

**Exclusão (hard fail)** — o candidato desaparece da lista principal e
passa para "Excluídos":
- `dir` diferente
- `st` (nº de talões) diferente — fisicamente não se inventam mais talões
- `len` — diferença acima da tolerância configurável (por omissão 0mm)

**Pontuação (soft fail)** — candidatos que passam a exclusão são
pontuados a partir dos desvios em `pax`, `main` e `add` (o `add` pesa mais
porque se repete `st` vezes e é o que mais desalinha o código de barras
por talão). Classificação:

| Score | Classificação |
|---|---|
| 100 | Match exato |
| ≥ 90 | Compromisso seguro |
| ≥ 60 | Compromisso arriscado |
| < 60 | Requer compilação nova |

Os pesos e limiares (`WEIGHTS`, `LEN_TOLERANCE_DEFAULT`,
`SAFE_THRESHOLD`, `RISK_THRESHOLD`) estão no topo de `app.js` e são um
ponto de partida — ajusta-os à tua experiência de campo.

## Importar medidas de um .docx

O botão "Preencher a partir do .docx" no formulário "Medida física" lê um
ficheiro `.docx` de medição física diretamente no browser (`word/document.xml`
dentro do `.docx`, que é um `.zip`, descomprimido com a `DecompressionStream`
nativa — sem bibliotecas externas, sem enviar o ficheiro para lado nenhum)
e tenta preencher `dir`, `st`, `len`, `pax`, `main`, `add` a partir de
rótulos comuns em inglês (`Bag tag length`, `Passenger Stub length`,
`Main tag part length`, `Additional Stub(s) length`, `How many additional
stubs`, e qual checkbox — Pax Stub ou Additional Stubs — está marcado).

É deteção **best-effort por regex**, não um parser garantido: foi
calibrada contra um formulário real (BHX) e é tolerante a alguma variação
de wording, mas qualquer formulário com uma estrutura muito diferente
pode não ser detetado. Confirma sempre os valores antes de procurar
match — a mensagem de estado diz exatamente que campos foram e não foram
detetados, e assinala quando "Additional Stub(s) length" lista mais do
que um valor (talões de tamanhos diferentes; usa o primeiro e avisa para
correres o match outra vez com o(s) outro(s)).

Requer um browser com suporte a `DecompressionStream` (Chrome/Edge 80+,
Firefox 113+, Safari 16.4+) — sem isso, mostra um erro claro e o
formulário preenche-se à mão como sempre.

## Visualizador

Desenha duas barras à escala: a medida física e o PECTAB selecionado,
sobrepostas. As fronteiras entre secções ficam marcadas; onde o desvio
entre físico e lógico excede o limiar de risco, a fronteira fica
assinalada a vermelho com o valor do desvio em mm.

## Histórico de testes

Por PECTAB, guarda-se um histórico local (não partilhado) de testes
físicos: data, aeroporto/handler, resultado (ok/falhou) e nota. Serve para
não repetires um teste já feito da última vez que estiveste no mesmo
aeroporto. Fica em `localStorage`, por máquina — não sincroniza entre
postos de trabalho.

## Folha de pedido de compilação

Quando nenhum candidato serve, o botão "Exportar pedido de compilação"
gera um `.txt` com os valores medidos e as notas de desvio do melhor
candidato encontrado, pronto a anexar a um pedido de compilação nova.

## Dados

Há dois ficheiros em `data/`:

- `data/sample-pectabs.json` — **exemplos fictícios** (FRA/P6301/P9201)
  com valores de demonstração, para testar rapidamente o motor de
  matching e o visualizador. Não são dados reais.
- `data/pectabs.json` — catálogo **real**, gerado a partir de um export
  DCS (`ADD.txt` + `PAX.txt`, formato descrito no `HELP.txt` desse
  sistema). 127 registos (58 de `PAX.txt`, 69 de `ADD.txt`). Regenerado
  com o script em `scripts/parse-pectabs.py` — ver secção seguinte.

Achados ao gerar o catálogo, só a partir do parsing (sem nenhuma medida
física envolvida):

- **76 dos 127 PECTABs (60%) têm `len` declarado diferente da soma
  `pax + main + st*add`**, com desvios entre -19mm e +45mm. Isto confirma
  que o problema "len não bate com a soma das secções" não é um caso
  isolado neste sistema — é a norma, não a exceção.
- `P8101` tem todos os campos de medida a zero (`len=main=add=pax=0`) —
  parece um registo placeholder/não configurado, não uma etiqueta real.
- 10 registos têm `eq=N` (talões adicionais de tamanhos diferentes):
  `P3101, P3102, P7701-P7704, P7801-P7804`.
- O campo `remarks` no export real é quase sempre só `N` (uma vez `Y`),
  nunca texto descritivo — ao contrário do exemplo no `HELP.txt`
  (`"barcodes outside"`). Provavelmente é um flag "tem observações
  noutro sítio", não o texto em si; foi importado tal e qual.

Botões na app: "Carregar catálogo (ADD+PAX)" carrega `data/pectabs.json`;
"Carregar exemplo fictício" carrega `data/sample-pectabs.json`. O botão
"Importar JSON" aceita qualquer array de registos no formato acima,
colado ou por ficheiro.

## Regenerar o catálogo a partir de novos exports

`scripts/parse-pectabs.py` lê os dois ficheiros de texto de largura fixa
(`pectab dir st len main add eq pax dest remarks`, um registo por linha,
campos separados por espaço, `remarks` livre até ao fim da linha) e
produz o JSON em `data/pectabs.json`:

```
python3 scripts/parse-pectabs.py caminho/PAX.txt caminho/ADD.txt > data/pectabs.json
```

Imprime avisos em stderr para linhas mal formadas, IDs duplicados entre
os dois ficheiros, e um resumo dos casos `len=0` / `eq=N` / `len != soma`
encontrados.

Depois de mudar `data/pectabs.json` ou `data/sample-pectabs.json`,
**corre também** `scripts/build-data-js.py` para regenerar `data.js` —
é esse ficheiro que a app carrega de facto, os `.json` em `data/` são só
a fonte legível/versionável:

```
python3 scripts/build-data-js.py
```

`data.js` é gerado — não editar à mão.

Ainda não há (nem está planeado sem uma amostra) um parser para a raw
string AEA da impressora — os formatos variam por fabricante e por
template carregado, não é uma conversão mecânica.

## Por construir (fora do âmbito desta primeira versão)

- Leitura da raw string AEA por fabricante de impressora
- Anexar fotos aos registos de histórico
- Sincronização entre postos de trabalho (fora do âmbito deliberado —
  ver acima)
