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

Não há passo de instalação. Abre `index.html` diretamente no browser
(duplo clique, ou `file://`). Não precisa de servidor.

## Modelo de dados

Um PECTAB é um registo com:

- `id` — identificador (ex: `P6301`)
- `dir` — `PAX` ou `ADD`, ordem de impressão das secções
- `st` — número de talões adicionais (bingo stubs)
- `len` — comprimento total declarado (mm)
- `pax` — comprimento da secção do passageiro (mm)
- `main` — comprimento da secção principal/código de barras (mm)
- `add` — comprimento de cada talão adicional (mm)
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

## Importar dados reais

O botão "Importar JSON" aceita um array de registos no formato acima. Não
há (ainda) um parser para `ADD.txt`/`PAX.txt` nem para a raw string AEA da
impressora — os formatos variam por fabricante e por template carregado,
por isso não é uma conversão mecânica. Ver `data/sample-pectabs.json` para
o formato esperado; os três registos aí são **exemplos ilustrativos**
(FRA/P6301/P9201) com valores de demonstração, não dados reais extraídos
de um DCS.

## Por construir (fora do âmbito desta primeira versão)

- Parser dedicado para exports `ADD.txt`/`PAX.txt` reais (formato a
  confirmar com uma amostra)
- Leitura da raw string AEA por fabricante de impressora
- Anexar fotos aos registos de histórico
- Sincronização entre postos de trabalho (fora do âmbito deliberado —
  ver acima)
