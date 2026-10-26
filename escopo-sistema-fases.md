# Escopo funcional — Sistema de Gestão de Contratos e Cobrança
**Locação de câmeras de segurança e portaria eletrônica (equipamentos Pináculo)**
Documento de proposta · versão 1.0 · 23/10/2026

---

## 1. Problema que o sistema resolve

| Dor atual | Consequência | O que elimina a dor |
|---|---|---|
| Tudo em planilha | Não se sabe quem pagou sem cruzar abas | Contas a receber com status por título + matriz de inadimplência |
| Não há gestão de contratos | Reajuste aplicado quando alguém lembra; prazo vencido passa despercebido | Contrato com vigência, itens, aditivos e reajuste versionado |
| Duas lógicas de cobrança misturadas | Boleto único do condomínio × boleto por morador gerado à mão | `billing_scope` no contrato + aderência de unidade |
| Sem custo por contrato | Não se sabe qual contrato dá prejuízo | Contas a pagar vinculadas ao contrato (F2) e margem por contrato |
| Sem histórico de preço | Discussão com cliente sobre "quanto era antes" | Item de contrato versionado por aditivo, nunca editado por cima |

**Valor entregue:** saber quem pagou, sem planilha, e ter o ciclo de vida do contrato controlado (emissão → reajuste → aditivo → distrato).

---

## 2. Princípios que valem para todas as fases

1. **Sem integração bancária.** O sistema não envia remessa nem lê retorno de cobrança. Emissão de boleto e de NF são **fatos registrados pelo usuário** (sim/não + data + número), e o pagamento é **dado baixado manualmente** com data obrigatória. Toda a visão financeira deriva desses flags.
2. **Preço não é módulo separado.** Existe um **Catálogo** (serviço/equipamento com preço público e custo) e o **item de contrato** carrega o preço negociado e a regra de reajuste. Reajuste **gera nova versão do item + aditivo**, não sobrescreve.
3. **Quatro camadas de cobrança:** `Contrato → Fatura (competência) → Título (boleto) → Pagamento`. A adimplência pode ser lida por contrato, por competência ou por morador porque cada camada existe separada.
4. **Condomínio pode ser cliente, e cliente pode ser vinculado a condomínio.** Contratos por unidade pendem do contrato-"mãe" do condomínio (`parent_contract_id`) e herdam suas condições.
5. **Orçamento é a entrada única de negócio.** Ao ser aprovado, itens `pontuais` viram **OS** e itens `recorrentes` viram **Contrato**. A origem fica gravada para medir taxa de conversão.
6. **Nada é apagado, tudo é status.** Distrato, estorno, cancelamento de NF e saída de morador encerram com data e motivo — é isso que torna a matriz confiável.

---

## 3. F1 — Núcleo comercial e cobrança (substitui a planilha)

**Objetivo:** no fim da F1, a operação mensal inteira (contratos, emissão, baixa, inadimplência) roda no sistema e a planilha é desligada.

### 3.1 Módulos e telas

**Cadastros**
| Tela | Conteúdo essencial |
|---|---|
| Clientes | PF/PJ, documentos, contatos, endereço; checkbox "é condomínio"; histórico de contratos |
| Condomínios | Dados do empreendimento, síndico/administradora, **unidades** (bloco/apto, titular), quantidade |
| Catálogo | Serviço ou equipamento, preço público, custo de referência, unidade de cobrança (mensal / hora / peça), índice padrão de reajuste |
| Equipamentos | Modelo, **nº de série**, status (em estoque / instalado / manutenção / baixado), contrato e local onde está instalado, garantia |
| Índices de reajuste | IPCA / IGP-M / INPC com série histórica — alimenta o cálculo do reajuste |

**Contratos**
| Tela | Conteúdo essencial |
|---|---|
| Contrato | Cliente, condomínio, vigência, `billing_scope`, condições, valor mensal, status (rascunho / vigente / suspenso / distratado) |
| Itens do contrato | Linha do catálogo, quantidade, preço negociado, ciclo, início, regra de reajuste (índice, periodicidade, próxima data) |
| Aditivos | Reajuste, acréscimo/remoção de item, mudança de escopo, distrato — cada aditivo versiona os itens e passa a valer de uma competência |
| Aderências (unidades) | Unidade + morador + `desde`/`até`; trocar morador não reescreve o contrato |
| Geração de cobrança | Job mensal que cria fatura + título por contrato vigente, respeitando escopo e aderências ativas |

**Financeiro**
| Tela | Conteúdo essencial |
|---|---|
| **Dashboard financeiro** | Receita recorrente, recebido, em atraso, a vencer, MRR, receita isenta; recebido × devido por competência; adimplência por competência; maiores devedores; **controle de emissão** (boletos não gerados, NFs não emitidas, recebimentos sem comprovante); composição da receita. Tudo sob filtro de competência/condomínio/escopo/situação |
| **Contas a receber** | Grade com devedor, condomínio, competência, valor, vencimento, **NF sim/não**, **boleto sim/não**, **pago sim/não**, **data do pagamento** (obrigatória), forma, multa+juros, total devido, situação. Ações em lote: gerar boletos (lote), marcar NF emitida, marcar como pago, reenviar 2ª via, exportar CSV. Drawer com histórico e comprovantes |
| **Matriz de inadimplência** | Devedor × competência, com em aberto, em atraso e adimplência por linha + rodapé "adimplência da competência". Projeção pura dos títulos — atualiza ao mudar status no contas a receber |
| Emissão em lote | Registro do lote (competência, títulos incluídos, datas de boleto e NF, quantidade, valor total) como prova auditável da emissão manual |

**Comercial**
| Tela | Conteúdo essencial |
|---|---|
| Orçamentos | Cliente/condomínio, itens do catálogo com `escopo` (pontual / recorrente), validade, status (aberto / enviado / aprovado / recusado / convertido) |
| Conversão do orçamento | Ao aprovar: gera OS para itens pontuais e contrato para recorrentes, com `origem_orcamento_id` |

**Transversal (F1):** login e perfis (comercial, financeiro, técnico), trilha de auditoria em toda mudança de status financeiro, backup diário, LGPD nos dados de moradores.

### 3.2 Regras de negócio da F1
- Multa 2% + juros 1% ao mês **prorrogados por dia** de atraso, recalculados ao abrir a tela.
- Marcar pago **sem data** é bloqueado; desmarcar pago gera estorno auditável.
- Título isento (convênio) **não entra** em adimplência nem em receita recorrente; aparece separado no dashboard.
- Contrato suspenso não gera fatura; distratado gera a última competência proporcional.
- Reajuste só é aplicado em item com `próxima_data_reajuste` vencida e índice com valor publicado na série.

### 3.3 Fora da F1 (explícito, para não virar retrabalho)
Remessa/retorno bancário, conciliação automática, estoque e compras, contas a pagar, OS com apontamento de execução, portal do morador, régua de cobrança automática, app do técnico.

### 3.4 Critérios de aceite da F1
1. Importar a planilha atual (clientes, condomínios, contratos, histórico de pagamento) com relatório de rejeições.
2. Rodar a competência mensal e ver fatura+título criados para 100% dos contratos vigentes, nos dois escopos.
3. Marcar um pagamento no contas a receber e ver **dashboard e matriz** refletirem a mudança na mesma sessão.
4. Aplicar um reajuste e consultar o valor anterior do item em qualquer competência histórica.
5. Fechar o mês sem abrir a planilha.

### 3.5 Pré-requisitos do cliente
- Planilha organizada para importação (1 linha por cobrança, colunas mínimas definidas no template).
- Número de contratos vigentes, unidades e histórico de 12 meses.
- Definir quem emite boleto e quem dá baixa (define os perfis).

---

## 4. F2 — Operação técnica e resultado por contrato

**Objetivo:** ligar o custo à receita e controlar o que acontece em campo.

| Módulo | Telas | Entrega |
|---|---|---|
| **Contas a pagar** (abre a F2) | Competência, fornecedor, categoria, valor, vencimento, **pago sim/não + data**, NF de entrada, vínculo opcional com contrato/OS/equipamento. Ações em lote: marcar pago, exportar CSV. Detalhe com histórico de pagamentos e estorno | Custo real por período e base da margem; espelha o contas a receber para fechar o caixa |
| Ordens de serviço | Lista de OS, abertura, execução com apontamento de horas e materiais, checklist, fotos, OS por contrato/equipamento | Instalação e manutenção rastreáveis; OS nasce do orçamento aprovado |
| Estoque e peças | Peças por modelo Pináculo, entrada/saída, aplicação em OS, estoque mínimo e alerta de compra | Custo real da intervenção |
| Compras e fornecedores | Pedido de compra, recebimento, NF de entrada, pagamento com prazo | Contas a pagar alimentada por documento, não por digitação livre |
| **Resultado por contrato** | Mensalidade − custo direto (equipamento, peças, horas) por contrato e por período | Mostra qual contrato dá prejuízo e sustenta o preço de renovação |
| Manutenção preventiva | Plano por contrato (periodicidade), geração automática de OS, pendências por condomínio | Reduz quebra e justifica a mensalidade perante síndico |

### 4.1 Contas a pagar — por que é o primeiro módulo da F2

É o lado espelhado do contas a receber da F1: mesma cadeia `Lançamento (competência) → Título a pagar → Pagamento`, mesmos flags manuais (sem integração bancária), mesma regra de multa/juros opcional quando o pagamento sai depois do vencimento. Por isso ele entra antes de estoque e compras — sem custo lançado não existe margem, e o dashboard da F1 já deixa o lugar pronto para receber o "a pagar".

**Telas e campos essenciais**

| Tela | Conteúdo essencial |
|---|---|
| Contas a pagar | Grade por competência: fornecedor, categoria (equipamento, instalação, manutenção, comissão, frete, taxa, outro), valor, vencimento, **pago sim/não + data**, NF de entrada, contrato/OS vinculada (opcional), situação (em aberto / vencida / paga). Filtros por fornecedor, categoria, competência e situação; ações em lote para marcar pago e exportar CSV |
| Lançamento avulso | Recorrente (mensalidade de link, aluguel de equipamento próprio) ou pontual (peça, serviço do técnico), com competência e centro de custo |
| Detalhe do lançamento | Pagamentos parciais e estorno com motivo, anexo da NF de entrada, histórico |
| Resumão por contrato | Custo do contrato no período, quando o lançamento tem vínculo — alimenta "Resultado por contrato" |

**Regras de negócio**
- Mesma regra de quitação do contas a receber: `pago` é consequência dos pagamentos registrados, e o saldo congela na data do pagamento.
- Lançamento com vínculo em contrato entra no custo daquele contrato; sem vínculo entra só no custo geral do mês.
- Categoria recorrente gera lançamento automático na competência seguinte (job igual ao da cobrança), com valor reajustável pelo mesmo mecanismo de índice da receita.
- Nada é apagado: estorno anula o pagamento com data e motivo, como no contas a receber.
- Sem NF de entrada o lançamento é permitido, mas marcado como "sem documento" — é o que impede o custo sumir da margem.

**Critério de aceite:** fechar a competência com o total a pagar batendo com as NFs de entrada conferidas, e ver o custo do mês ao lado da receita no dashboard.

**Critérios de aceite da F2:** fechar o mês com contas a pagar batendo com os recebimentos de NF; ver margem de um contrato escolhendo-o na tela; uma OS de instalação consumir estoque e refletir no custo do contrato de origem.

---

## 5. F3 — Cobrança ativa, autoatendimento e escala

**Objetivo:** reduzir a inadimplência com processo, não com esforço manual.

| Módulo | Entrega |
|---|---|
| Régua de cobrança | Avisos automáticos por e-mail/WhatsApp em D-3, D+1, D+15, D+30, com template por escopo (síndico × morador) e registro do envio |
| Acordos e parcelamento | Negociação de dívida com plano de pagamento, multa do distrato, geração dos títulos do acordo |
| **Portal do morador** | 2ª via do boleto, histórico, comprovante, atualização de aderência — derruba ligações pedindo via |
| Conciliação por importação | Importar CSV/OFX do banco e dar baixa por valor+data+nosso número; permanecendo sem integração, é o atalho que resolve 90% do volume |
| App do técnico | OS em campo, apontamento offline, assinatura do cliente |
| Relatórios gerenciais | Série de adimplência por condomínio/coorte, churn, LTV por contrato, produtividade por técnico |
| Multiempresa / permissões finas | Separar síndico, administradora e matriz quando a operação crescer |

---

## 6. Estimativa de esforço

Premissa: **1 dev full-stack + 1 dev front half-time**, com especificação aprovada antes de codar. Ajustar proporcionalmente se o time for maior.

| Fase | Módulos | Esforço dev | Calendário sugerido |
|---|---|---|---|
| **F1** | Cadastros + catálogo | 12–16 dias | |
| | Contratos, itens, aditivos, reajuste | 18–24 dias | |
| | Geração de cobrança + contas a receber | 15–20 dias | |
| | Dashboard + matriz de inadimplência | 10–14 dias | |
| | Orçamento → OS/contrato (OS simplificada) | 8–10 dias | |
| | Transversal (perfis, auditoria, importação, backup) | 10–14 dias | |
| | Testes, importação dos dados reais, homologação | 10–12 dias | |
| | **Total F1** | **83–100 dias** | **≈ 4 meses** |
| **F2** | Contas a pagar (abre a fase) | 10–14 dias | |
| | OS + estoque + compras + margem + preventiva | 45–56 dias | ≈ 3 meses |
| **F3** | Régua + acordos + portal + conciliação + app + relatórios | 60–80 dias | ≈ 3–4 meses |

**Risco de estimativa:** a F1 depende mais da qualidade da planilha legada do que do código. Prever 5–10 dias de saneamento de dados se o histórico vier sem competência, sem forma de pagamento ou com devedor ambíguo (condomínio × morador).

---

## 7. Sequência de implantação

1. **Semana 1–2:** aprovar este escopo, validar o mockup das telas financeiras, definir template de importação.
2. **Construção F1** com demonstração quinzenal usando dados reais de um condomínio-piloto.
3. **Carga de dados + paralelismo:** rodar sistema e planilha juntos por **2 competências completas**. Só desligar a planilha depois que a matriz bater com o fechamento manual.
4. **Go-live F1** no início de uma competência (nunca no meio).
5. **F2** começa depois de 1 mês de F1 estável — senão o time de operação não adota. Primeiro módulo: **contas a pagar** (é o espelho do contas a receber e destrava a margem); OS e estoque vêm em seguida.
6. **F3** por peça: régua de cobrança primeiro (maior retorno), portal depois.

---

## 8. Decisões pendentes antes do kickoff

| # | Pergunta | Por que trava | Resposta |
|---|---|---|---|
| 1 | Quem emite o boleto hoje e em quantos bancos? | Define se o lote precisa separar por conta e se a F3 de conciliação sobe de prioridade | **Um prestador (CNPJ), em um único banco.** O lote não precisa separar por conta, e a conciliação da F3 continua de baixa prioridade: não há arquivo de banco a cruzar, e o `nosso_numero` volta do prestador e é registrado à mão |
| 2 | A NF é emitida por contrato, por título ou por competência do condomínio? | Muda a granularidade do flag `nf_emitida` | **Por contrato.** Como cada contrato gera exatamente 1 título por competência, o flag no título já é "por contrato na competência". Pendente confirmar: se for uma NF só para várias competências, o flag muda de granularidade |
| 3 | Existe convênio/isenção hoje? Quantos casos? | Afeta o cálculo de adimplência exibido ao síndico | **Não tem convênio, zero casos.** A isenção continua no modelo (regra do §3.2 e o flag já existem) mas não entra em uso: o KPI de receita isenta do dashboard fica em R$ 0,00 e o denominador da adimplência nunca é reduzido por convênio |
| 4 | Reajuste é anual no aniversário do contrato ou em data fixa da categoria? | Define a regra do item e o job mensal | **Anual, com a opção no cadastro.** Já existe: `periodicidade` (ANUAL/SEMESTRAL/NENHUM) por item e `proximo_reajuste_em` derivado da vigência. Falta só expor a data fixa da categoria, se ele quiser |
| 5 | Morador é cliente do contrato ou só unidade aderente? | Se emite NF para o morador, ele precisa de CPF e cadastro próprio | **Os dois casos existem**, e o condomínio às vezes é o contratante (CNPJ). O modelo já cobre: `contrato_unidades.morador_id → clientes`, e o contrato pode ter cliente PF (morador) ou PJ (condomínio). Pendente: o título mostra a *unidade* como devedor e não carrega o documento do morador, que a NF precisaria |
| 6 | Quantos contratos e unidades hoje? | Dimensiona a importação e o teste de carga do job de cobrança | **~10 contratos.** Volume pequeno: ~10 títulos por competência, ~120 por ano. O teste de carga do job perde sentido e a importação é rápida de homologar |

---

## 9. Fora de escopo permanente (salvo renegociação)

Integração bancária com remessa/retorno, certificação digital e emissão fiscal dentro do sistema (o sistema **registra** a NF, não emite), medição presencial de campo, e qualquer funcionalidade de controle de acesso dos equipamentos (são do fabricante/Pináculo).

---

**Anexo:** mockup navegável das três telas financeiras da F1 em `mockup-telas.html` (Dashboard, Contas a receber, Matriz de inadimplência) — abrir no navegador.
