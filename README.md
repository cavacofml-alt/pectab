# PECTAB Toolkit

Ferramenta local, sem backend, para validar e comparar configurações PECTAB
(etiquetas de bagagem) contra medidas físicas de papel, antes de as testar
numa impressora real.

Nasceu de um problema recorrente em auditorias de aeroporto: escolher um
PECTAB existente no DCS às cegas, imprimir, e só descobrir em papel que o
`len` declarado não bate com a soma das secções, ou que a fronteira
stub/main não coincide com a perfuração física do rolo.

## Estrutura da página

A página segue o fluxo de trabalho real, de cima para baixo, não uma
lista de painéis administrativos:

1. **① Medir** — formulário de medida física (com importação de `.docx`
   e a legenda de tradução de termos, colapsada).
2. **② Resultado do match** — o "melhor candidato" em destaque (cartão
   com banner de decisão operacional, checklist do porquê bate certo, e
   o cálculo do score aberto por detalhe), os outros candidatos numa
   lista compacta por baixo, e os excluídos colapsados.
3. **③ Validação visual** — o visualizador (agora o centro da app, não
   uma secção qualquer) e o histórico de testes do PECTAB selecionado.
4. **Administração** (colapsada por omissão) — base de PECTABs com
   busca/filtro, adicionar PECTAB, importar JSON, e o histórico completo
   (todos os PECTABs, com exportação CSV).

A decisão operacional (`decisionFor()` em `app.js`) reduz as 4
classificações técnicas (exact/safe/risky/recompile) a 3 níveis de
resposta direta — 🟢 usar, 🟡 verificar antes de usar, 🔴 não usar — para
a pergunta "posso usar isto ou não" nunca ficar ambígua. O botão "Gerar
relatório de validação" exporta tudo isto (medidas, PECTAB, cálculo do
score, decisão, avisos) num `.txt`, distinto do "pedido de compilação"
(que é especificamente para pedir um PECTAB novo).

## Idioma

Botões PT/EN no canto superior direito. A escolha fica em `localStorage`
(chave `pectab.lang`) e sobrevive a recarregar a página. As traduções
estão em `i18n.js` — `I18N.pt` / `I18N.en`; texto estático usa atributos
`data-i18n`/`data-i18n-html`/`data-i18n-title` no HTML, texto gerado em
JS (resultados, avisos, exportações, toasts) passa por `t(key, vars)`.
Nenhum texto traduzível fica guardado já traduzido em `state` — os
avisos de match, por exemplo, guardam `{key, params}` e só são
traduzidos no render, para que trocar de idioma sem repetir a busca
atualize tudo (incluindo os avisos) de imediato.

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
  (quando `false`, o campo `add` é só um valor nominal — a app mostra
  sempre um aviso nesse caso)
- `stubLengths` — opcional, array com o comprimento real de cada talão
  por ordem (ex: `[16, 20]`), só usado quando `eq=false` **e** as
  `remarks` do próprio catálogo já davam essa repartição de forma
  inequívoca (ex: "second stub is 20mm", ou um padrão `"10/10/15"` com
  tantos números quanto `st`). Quando existe, o visualizador desenha
  cada talão com o seu comprimento real (em vez de repetir `add` para
  todos) e a soma das secções (`sectionSum`) usa os valores reais em
  vez de `st × add` — isto já corrigiu falsos avisos de "len não bate
  com a soma" em registos como o `P5001` (que na realidade bate certo
  exatamente, 16+20≠2×16). **Não foi inventado nem estimado** — só
  existe nos ~11 registos onde a fonte já continha os números; o resto
  dos `eq=false` continua só com o valor nominal em `add`.
- `dest` — nº de destinos que o PECTAB suporta (informativo)
- `inUse` — booleano opcional, se o PECTAB está atualmente em uso segundo
  quem gere os PECTABs. Quando `false`, nunca aparece à frente de um
  candidato ativo na lista (só se não houver nenhum ativo disponível), e
  mostra sempre um aviso — recomendar um PECTAB descontinuado sem avisar
  seria pior do que não recomendar nada.
- `mirrorPoint` — opcional, ponto de dobra da etiqueta em mm (informativo,
  não usado no matching)
- `remarks` — texto livre

A "medida física" introduzida no formulário de matching usa exatamente os
mesmos campos — mede-se o rolo com uma régua e preenche-se da mesma forma
que um PECTAB, para que a comparação seja direta. Tem um campo extra,
opcional, `width` (largura, mm) — não existe nos registos do catálogo e
não entra no motor de matching; serve só para o confronto com stocks
conhecidos da indústria (ver secção própria).

### Ordem de impressão das secções

Isto é uma **assunção**, não um facto confirmado a partir de exports reais
do DCS — verifica contra o que vês fisicamente e ajusta o interruptor
"Ordem de impressão" no visualizador se estiver ao contrário:

- `dir = PAX` → assume-se `[PAX, MAIN, ADD×st]`
- `dir = ADD` → assume-se `[ADD×st, MAIN, PAX]`

### Desenhos técnicos de fornecedores não dizem qual a direção

Um desenho técnico de um fornecedor de impressão (ex: um ficheiro de
especificação com cotas em mm) mostra o comprimento de cada secção, mas
não diz qual delas é `pax` e qual é `add` — isso infere-se por grandeza
(no catálogo, `pax` costuma andar entre 38-70mm, `add` entre 11-24mm), e
**não diz a direção de impressão** (`dir`), porque essa é uma convenção
do DCS, não uma medida física do desenho.

Caso concreto: um desenho com duas tiras finas (~20-23mm, magnitude de
`add`) de um lado e uma secção maior (~63mm, magnitude de `pax`) do
outro, com `len≈507-509mm` e `st=2`, dá **dois candidatos válidos e
diferentes** dependendo da direção assumida:

- `dir=ADD` (talões primeiro) → melhor candidato **P6901** (score 77,
  arriscado)
- `dir=PAX` (talão passageiro primeiro) → melhor candidato **P6603**
  (score 81, arriscado — e a nota do registo, "20/23 — barcodes
  outside", coincide exatamente com as duas medidas lidas no desenho)

Nenhum dos dois é claramente superior só pelos números — a pontuação
mais alta (P6603) não é prova de que a direção é essa, só de que essa
hipótese explica melhor os dados *se for essa a direção real*. A lição:
sempre que faltar a direção de impressão, corre a busca **nas duas
direções** e compara os dois melhores candidatos, em vez de escolher
uma direção por inferência e parar na primeira correspondência
plausível — e procura nas notas (`remarks`) dos candidatos por detalhes
que coincidam com o desenho (medidas específicas, "barcodes outside",
etc.), que ajudam a desempatar entre hipóteses.

**Direção "Desconhecida — testar as duas"**: em vez de correr a busca
manualmente duas vezes, o formulário de medida física tem uma terceira
opção em "Direção de impressão". Com ela, o motor compara cada
candidato do catálogo usando a *sua própria* direção declarada (o
"gate" de `dir` deixa de excluir seja quem for) — os resultados juntam
candidatos PAX-primeiro e ADD-primeiro na mesma lista, ordenados só
pelo score, e cada candidato mostra qual hipótese assume. É exatamente
o caso P6901/P6603 acima, automatizado.

### PECTABs fisicamente indistinguíveis

Quando o candidato recomendado tem outros registos no catálogo com a
mesma especificação física exata (`dir`/`st`/`len`/`pax`/`main`/`add`
todos iguais — ver a lista completa na secção "Dados"), a app já não
escolhe um arbitrariamente sem avisar: mostra um aviso no próprio
cartão do resultado a listar todos os IDs do grupo, porque a medida
física, por definição, não consegue desempatar entre eles — só
`remarks`, destino ou quem os pediu é que distingue.

## Confronto com stocks conhecidos da indústria

Além de comparar contra o catálogo de PECTABs (a fonte autoritativa,
específica desta operação), a app também confronta a medida física
contra **tamanhos de stock genéricos, conhecidos na indústria** — um
segundo sinal, independente, para quando se recebe uma medida de um
cliente ou fornecedor de impressão e se quer confirmar se está dentro
do que é fisicamente normal, mesmo antes de saber qual PECTAB usar.

Isto nunca substitui o catálogo nem entra no motor de matching (o
campo `largura` é só para este confronto — o motor continua a
trabalhar só no eixo do comprimento). Aparece como um painel próprio
("Confronto com stocks conhecidos da indústria") depois de procurar
match.

Referências usadas (`INDUSTRY_STOCK_STANDARDS` em `app.js`):

- **Largura**: 50,80mm-54,00mm (IATA Resolution 740, Attachments S1/T)
  — a única verificação **ativa** (mostra aviso se a largura medida
  ficar fora deste intervalo).
- **Tamanhos comerciais conhecidos**: 2" × 21" (51mm × 533,4mm) e
  2,125" × 21,25" (54mm × 540mm) — nota **só positiva** quando o
  comprimento bate certo com um destes, nunca um aviso quando não bate
  (não bater é o caso normal — a maioria dos PECTABs reais não é
  nenhum destes dois tamanhos).
- **Espaçamento entre etiquetas** (3,175mm-6,00mm, recomendado 6,00mm;
  IATA Resolution 740): documentado aqui como facto, mas sem
  verificação ativa na app — é uma medida do rolo/produção, não algo
  que o agente de campo meça numa etiqueta individual.

**Deliberadamente sem intervalo de comprimento "típico"**: chegámos a
ter um (400-600mm, de fichas técnicas de impressoras Epson/Urielsoft),
mas foi removido depois de um debate cruzado revelar um problema real:
esse intervalo teria dado um falso aviso no nosso próprio PECTAB
`P5401` (350mm, talão único), que é um registo real e válido do
catálogo. A Zebra documenta impressoras móveis vendidas explicitamente
para "Airline Baggage Tags" com intervalo de 12,7mm-813mm — largo
demais para servir de aviso útil, por isso preferimos não ter nenhum
intervalo de comprimento genérico em vez de ter um errado.

### Como estes números foram verificados

O acesso aos documentos primários (iata.org, scribd, wikipedia, sites
de fabricantes) está bloqueado pela rede deste ambiente — nunca foram
lidos diretamente. Em vez disso, foram verificados por um **debate
cruzado entre dois modelos de IA diferentes** (Gemini e ChatGPT), cada
um a pesquisar de forma independente e depois a criticar/testar as
afirmações do outro, com pedido explícito para admitirem incerteza em
vez de manterem uma resposta só por consistência. O processo apanhou
dois erros reais antes de entrarem no código:

- Um dos modelos inventou um "limite mecânico de 635mm" ligado a
  modelos de impressora específicos (Unimark BT700, Zebra TTP) — que
  admitiu, quando confrontado, ser uma confusão com as dimensões
  externas da caixa de uma impressora VidTroniX, sem relação com o
  comprimento de etiquetas.
- Um dos modelos afirmou que a IATA define duas "orientações
  nomeadas" (claim-check-first vs. bingo-stub-first) que explicariam a
  ordem de impressão — o outro modelo negou diretamente que isso
  exista no documento. Sem forma de verificar o documento primário,
  descartámos esta afirmação por completo, mesmo sendo a mais
  interessante das duas — não entrou em lado nenhum do código nem
  documentação.

Os números que sobraram (largura IATA, os dois tamanhos comerciais, a
inexistência de uma ordem de impressão universal) foram confirmados
de forma consistente por ambos os modelos em rondas sucessivas,
incluindo depois de serem desafiados diretamente a provar ou retratar
cada afirmação — e a conclusão sobre a ordem de impressão bate
certo com o que já sabíamos pelos nossos próprios dados (grupos de
PECTABs com a mesma especificação física em `dir=PAX` e `dir=ADD`).
Mesmo assim, tratam-se como referência secundária, não confirmada
diretamente — e mesmo que estivessem 100% confirmados, isto **não
resolve a ambiguidade de direção de impressão** (ver secção anterior)
— stocks de indústria descrevem o material em bruto, não a forma como
cada companhia o divide em `pax`/`main`/`add` no DCS.

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
- `data/pectabs.json` — catálogo **real**, 173 registos. Fonte atual:
  uma folha de cálculo ("bagtag specs") obtida diretamente de quem gere
  e cria os PECTABs — mais rica e mais atual do que o export bruto do
  DCS (`ADD.txt`/`PAX.txt`) usado antes. Regenerado com
  `scripts/parse-bagtag-specs-xlsx.py` — ver secção seguinte.

Esta fonte trouxe campos que o export do DCS não tinha:

- **`inUse`** — se o PECTAB está atualmente em uso. 17 dos 173 estão
  marcados `false` (descontinuados/substituídos). A app nunca deixa um
  destes aparecer à frente de um candidato ativo, e mostra sempre um
  aviso quando aparece (só quando não há nenhum ativo disponível).
- **`remarks`** com contexto real de quem os criou — nome de
  companhia/aeroporto, avisos tipo "AYT specific, do not change!!" ou
  "HARDCODED NEOS", motivo de layouts especiais. Ao contrário do export
  do DCS (onde `remarks` era quase sempre só um `N`/`Y` sem texto), aqui
  é texto explicativo real — importado tal e qual, sem filtrar.
- **`mirrorPoint`** — ponto de dobra da etiqueta (só informativo).

Comparando com o catálogo antigo (127 registos, do `ADD.txt`/`PAX.txt`):
todos os 127 IDs existem também nesta fonte, mais 49 que não estavam no
export do DCS. 5 registos têm valores diferentes entre as duas fontes —
por exemplo `P5801`, que o DCS ainda listava com a configuração antiga
(`st=3`) mas que a folha de quem o gere diz explicitamente ter sido
reconfigurado para "NO STUBS (EEZY tags kiosk)". Nestes 5 casos, esta
fonte (mais recente, com contexto humano) prevaleceu. `P8101` (que no
catálogo antigo aparecia com todos os valores a zero, um placeholder)
não está incluído — a folha confirma que é mesmo um slot vazio
("temp dnata", sem configuração), não uma etiqueta real.

Botões na app: "Carregar catálogo (ADD+PAX)" carrega `data/pectabs.json`;
"Carregar exemplo fictício" carrega `data/sample-pectabs.json`. Ambos
fazem **upsert** — não só adicionam IDs novos, também atualizam
registos já existentes localmente cujos valores tenham mudado na fonte
(antes só adicionavam, e uma correção nos dados nunca chegava a quem
já tinha usado a app antes — carregar de novo dizia sempre "0
adicionados" mesmo com o catálogo desatualizado). O botão "Importar
JSON" aceita qualquer array de registos no formato acima, colado ou por
ficheiro, e já fazia upsert desde sempre.

Todos os registos entram em `state.db` como cópias (nunca a referência
direta a `PECTAB_CATALOG`/`PECTAB_SAMPLE`) — sem isto, editar ou
apagar um PECTAB na app corrompia silenciosamente essas constantes
globais, e "Carregar catálogo" deixava de conseguir detetar diferenças
(estaria a comparar o catálogo corrompido contra ele próprio).

Como "Importar JSON" aceita **qualquer** conteúdo sem validar o schema,
todos os campos de um registo (`id`, `dir`, etc.) passam por
`escapeHtml()` antes de irem para o ecrã — um ficheiro JSON recebido
de outra pessoa (colega, fornecedor) não consegue injetar HTML/script
na página só por ser importado.

### Verificação sobre o catálogo todo

Para validar o motor de matching não só em casos isolados mas nos 173
registos reais de uma vez, corremos `matchOne`/`computeMatches` (o
código de `app.js`, sem alterações) fora do browser, fazendo
self-match de cada registo contra si próprio e contra o catálogo
inteiro, a duas tolerâncias (0mm e 6mm). Resultado: zero crashes, zero
self-matches que não dessem "exato", zero anomalias na decisão
`inUse` — o motor comporta-se de forma consistente em todo o
catálogo, não só nos casos testados manualmente (P6301/P9201,
P0701/P2101). Esta verificação não apontou nenhum bug, mas revelou duas
características dos próprios dados que vale a pena confirmar com quem
gere os PECTABs:

1. **34 grupos de PECTABs com especificação física idêntica**
   (mesmo `dir`/`st`/`len`/`pax`/`main`/`add`), 47 IDs no total "à
   sombra" de outro. Por exemplo, `P0401`, `P0403`, `P0404` e `P0405`
   são todos `PAX · 2 talões · 400mm · pax 55 · main 320 · add 12` —
   fisicamente indistinguíveis. A app recomenda sempre o ID de menor
   número de cada grupo (critério de desempate por ordem no catálogo);
   os restantes nunca aparecem em primeiro lugar, mesmo que a medida
   física bata certo exatamente com eles. Pode ser intencional (mesmo
   layout emitido para rotas/destinos diferentes) ou redundância a
   limpar no catálogo — não há como distinguir sem confirmação humana.
   Outros grupos: `P0801`/`P6801`/`P8701`; `P2601`-`P2604`+`P3001`;
   `P8501`/`P8503`/`P8504`/`P8901`/`P8902`/`P9001`/`P9002`; entre mais
   29 pares/grupos menores.

2. **14 registos com "soma das secções ≠ comprimento declarado" bem
   acima do ruído habitual.** O aviso `warn.lenSum` já existe na app
   para qualquer diferença (a maioria dos 104 casos no catálogo é
   ±1-3mm, já documentado como normal), mas estes 14 destacam-se por
   serem muito maiores: **P5301 (soma 95mm maior que o `len`
   declarado)**, **P5603 e P7401 (-45mm cada)**, **P9102 (-37mm)**,
   **P4702–P4704 (-29 a -31mm)**, e mais 8 entre -21 e +50mm. Podem
   refletir um desenho físico real (ex: secções que se sobrepõem) ou
   um erro de transcrição na folha de origem — vale confirmar
   especificamente estes com o especialista, já que o desvio é grande
   demais para ser só arredondamento.

## Regenerar o catálogo a partir de novos dados

Fonte atual (folha de cálculo "bagtag specs", uma aba chamada
`bagtag specs` com as colunas `Pectabnr, orientation, nr of additional
stubs, total tag length, Length of main tagpart, length of one
additional stub, additional stubs are all same size, length of pax
stub, limiting features, Currently in use, limiting, remarks,
Mirrorpoint`):

```
python3 scripts/parse-bagtag-specs-xlsx.py caminho/bagtag-specs.xlsx \
  --dest-source data/pectabs.json > data/pectabs.json.new
mv data/pectabs.json.new data/pectabs.json
```

`--dest-source` é opcional — aponta para o `data/pectabs.json` atual só
para copiar o campo `dest` (que esta folha não tem) para os IDs que já
existiam. Sem essa flag, `dest` fica de fora para todos.

Se só tiveres o export bruto do DCS (`ADD.txt`/`PAX.txt`, sem o `inUse`/
`remarks` ricos), `scripts/parse-pectabs.py` continua a funcionar como
alternativa — lê os dois ficheiros de texto de largura fixa (`pectab dir
st len main add eq pax dest remarks`, um registo por linha) e produz o
mesmo formato de JSON:

```
python3 scripts/parse-pectabs.py caminho/PAX.txt caminho/ADD.txt > data/pectabs.json
```

Ambos os scripts imprimem avisos em stderr para linhas mal formadas,
IDs duplicados, e um resumo dos casos a confirmar.

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
