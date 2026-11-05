# Escopo — Multiempresa (Premura como prestadora de serviço)
**Fundação multiempresa para o sistema de gestão de contratos e cobrança**
Documento de proposta · versão 1.0 · 03/11/2026

> Relacionado ao item "Multiempresa / permissões finas" previsto na F3 de `escopo-sistema-fases.md` — mas motivado por um caso real diferente do que estava lá: não é síndico × administradora, é uma prestadora de serviço (Premura) atendendo várias empresas-cliente a partir de uma conta só. Por isso ganha documento próprio, e por ser fundação (toca o modelo de dados inteiro), tende a vir **antes** do resto da F3, não depois.

---

## 1. Problema que resolve

Hoje o sistema é **single-tenant**: existe uma empresa só (Segplace), um `DadosEmpresa` único, e todo cliente/contrato/orçamento/conta pertence implicitamente a ela. A Premura, que presta serviço de gestão financeira e de contratos (contas a receber, contas a pagar, contratos/orçamentos) para **várias empresas-cliente** — hoje a Segplace e mais uma com funcionários, com expectativa de crescer pra 3–10 — não tem como usar uma conta só pra transitar entre elas. Hoje, pra atender uma empresa nova, seria preciso subir uma instância nova do sistema inteiro.

**Valor entregue:** a equipe da Premura loga uma vez e acessa todas as empresas que atende, cada uma com seus próprios dados isolados; cada empresa-cliente (como a Segplace hoje) continua enxergando só os próprios dados, sem perceber que existem outras.

### 1.1 Exemplo real: MR Instalações (serralheria)

Segunda empresa atendida pela Premura, com perfil de negócio diferente da Segplace — confirma que o sistema não pode assumir "toda empresa tem contrato recorrente":

- **MR Instalações Ltda ME**, CNPJ 18.223.203/0001-02 (Manoel Reis), serralheria: portão de correr, revisão de telhado, escada, etc.
- Modelo comercial **100% pontual**: orçamento (ex.: "Portão de correr em duas folhas, 57m², R$ 13.580,00") é aprovado e vira **uma OS que cobra o valor total de uma vez** — não existe mensalidade nem competência recorrente. Validade do orçamento: 15 dias. Pagamento via PIX/transferência (chave PIX = o próprio CNPJ, Banco Bradesco).
- **Contas a pagar dela inclui despesas administrativas genéricas**, não só custo de obra: folha de funcionários, boletos de fornecedor, **DARF** (imposto), internet, conta de celular — categorias que não existem hoje no `CategoriaContaPagar` (que foi desenhado só para o negócio de câmeras: equipamento, instalação, manutenção, comissão, frete, taxa, outro).
- **Contas a receber dela é só OS criada de orçamento aprovado** — ela controla isso hoje numa planilha Google Sheets (modelo não anexado ainda; pendente — ver §7).

**Gap técnico identificado:** no schema atual, `Titulo.contratoId` é **obrigatório** — todo título de cobrança depende de um Contrato por trás. Não existe caminho pra gerar cobrança direto de uma OS pontual sem contrato. Isso precisa ser resolvido na fundação multiempresa (ver §3.6), senão a MR Instalações não consegue emitir cobrança nenhuma no sistema.

---

## 2. Princípios

1. **Empresa é entidade de primeira classe.** Toda tabela de negócio (cliente, contrato, orçamento, conta a pagar/receber, catálogo, equipamento) passa a pertencer a uma empresa. Isolamento é lógico (uma coluna `empresaId` + filtro em toda consulta), não é banco separado por empresa — suficiente pra dezenas de empresas, sem o custo operacional de múltiplas instâncias.
2. **Duas camadas de usuário, não uma.**
   - **Equipe da Premura**: acesso transversal — enxerga **todas** as empresas automaticamente, inclusive as cadastradas depois, sem precisar de permissão manual por empresa nova.
   - **Equipe local de cada empresa** (ex.: a equipe própria da Segplace hoje — `admin/comercial/financeiro/tecnico@denisplace.com.br`): acesso só à própria empresa, exatamente como funciona hoje. Zero percepção de mudança pra quem já usa o sistema.
3. **Papel continua sendo o mesmo conceito — muda só quem o atribui.** ADMIN/COMERCIAL/FINANCEIRO/TECNICO e a matriz de permissão por módulo (já implementada em `/usuarios/perfis`) continuam valendo igual pra todo mundo. O que muda: pra equipe local, o papel passa a ser atribuído **por empresa** (a mesma pessoa pode ser Financeiro numa empresa e não ter acesso a outra); pra equipe Premura, o papel continua único e vale em todas as empresas de uma vez.
4. **Módulo é habilitável por empresa, não fixo globalmente.** Nem toda empresa usa os mesmos módulos — a Segplace precisa de Orçamentos/Contratos/Câmeras, outra empresa pode não precisar de nada disso.
5. **Departamento pessoal não é módulo novo.** Como a Premura só agenda pagamento e guarda comprovante (o cálculo da folha é feito pela Contabilidade terceirizada de cada empresa), isso entra como uma **categoria nova dentro de Contas a Pagar**, não como um domínio separado. Ver §3.5.
6. **Migração sem regressão.** Tudo que existe hoje (dados da Segplace, os 4 usuários, histórico de contratos/cobrança) vira o primeiro registro de `Empresa`, sem perda nem mudança de comportamento percebida pela equipe atual.

---

## 3. Modelo de dados (visão geral)

### 3.1 `Empresa` (substitui o singleton `DadosEmpresa`)
Os mesmos campos que `DadosEmpresa` já tem (razão social, nome fantasia, CNPJ, contato, endereço, logo, observações de rodapé do PDF) — só que agora é uma tabela de verdade, um registro por empresa-cliente, em vez de uma linha única.

### 3.2 `empresaId` espalhado
Adicionado em todas as tabelas que hoje são implicitamente "da Segplace": `Cliente`, `Condominio`, `Unidade`, `CatalogoItem`, `Equipamento`, `Contrato`, `ContratoItem`, `AditivoContratual`, `Orcamento`, `ContaPagar`, `Fatura`/`Titulo`, `EmissaoLote`, `AuditLog`. Toda consulta e toda action existentes precisam passar a filtrar por `empresaId` — esse é o grosso do esforço de implementação, não o schema em si.

**Pendente de decisão** (ver §7): `IndiceReajuste`/`IndiceValor` (IPCA, IGP-M, INPC) — sugestão é manter **compartilhado entre todas as empresas** (são índices públicos, iguais pra todo mundo; duplicar por empresa só daria recadastro sem necessidade).

### 3.3 Acesso — duas tabelas novas
- **`UsuarioEmpresa` (usuarioId, empresaId, papel)** — vínculo explícito pra equipe **local**: define em quais empresas a pessoa entra e com qual papel em cada uma.
- **`User.ehPremura: boolean`** — quando verdadeiro, o `papel` que já existe hoje no próprio `User` vale **em todas as empresas automaticamente**, sem precisar de uma linha de `UsuarioEmpresa` por empresa. É o que permite a Premura crescer pra uma empresa nova sem reconceder acesso pessoa por pessoa.

### 3.4 `EmpresaModulo` (empresaId, modulo, habilitado)
Controla quais módulos aparecem no menu de cada empresa. O menu final de alguém é a interseção de duas coisas: *a empresa ativa tem esse módulo ligado?* **e** *o papel da pessoa naquela empresa permite ver/editar?* (essa segunda parte já existe hoje, em `/usuarios/perfis`).

### 3.5 Folha de pagamento dentro de Contas a Pagar (não é módulo novo)
- Nova categoria no enum `CategoriaContaPagar`: **`FOLHA_PAGAMENTO`**.
- Novo campo opcional de anexo no lançamento: **recibo assinado** (hoje só existe o anexo de "NF de entrada"; passa a aceitar também o comprovante assinado devolvido pelo funcionário, além do holerite recebido da Contabilidade, que entra como o anexo já existente).
- Documento avulso por competência, **sem nenhum cálculo** — exatamente como confirmado: Premura recebe o holerite pronto, agenda o pagamento no banco, controla o recibo de volta.
- Opcional, pra organizar (não bloqueia a entrega mínima): cadastro simples de **`Funcionario`** por empresa (nome, documento, cargo, ativo/desligado), pra ter histórico de pagamento por pessoa em vez de texto livre todo mês.

### 3.6 Categorias de Contas a Pagar precisam generalizar

O `CategoriaContaPagar` atual (`EQUIPAMENTO, INSTALACAO, MANUTENCAO, COMISSAO, FRETE, TAXA, OUTRO`) foi desenhado só pro negócio de câmeras da Segplace. A MR Instalações confirma que uma empresa-cliente qualquer tem despesas administrativas genéricas que não se encaixam aí: **boleto de fornecedor, DARF (imposto), internet, telefone/celular**, além da folha de pagamento (§3.5). Duas abordagens possíveis:

- **(a) Ampliar o enum global** com categorias genéricas que servem qualquer empresa: `FOLHA_PAGAMENTO`, `IMPOSTO`, `UTILIDADE` (água/luz/internet/telefone), `BOLETO_FORNECEDOR`, mantendo as específicas de câmeras (`EQUIPAMENTO`, `INSTALACAO`, etc.) pra quem precisar.
- **(b) Categoria customizável por empresa** (tabela em vez de enum fixo) — mais flexível a longo prazo, mais trabalho agora.

Sugestão: começar com **(a)** — resolve o caso real sem esperar um mecanismo de customização que ninguém pediu ainda; migrar pra (b) só se aparecer uma necessidade concreta de categoria muito específica de uma empresa só.

### 3.7 Cobrança direta de OS pontual, sem Contrato (gap crítico pra MR Instalações)

Hoje `Titulo.contratoId` é obrigatório — toda cobrança nasce de um Contrato vigente com competência mensal. Isso cobre bem o modelo da Segplace (mensalidade recorrente), mas **não cobre uma empresa 100% pontual como a MR Instalações**, onde orçamento aprovado vira OS e a cobrança é o valor total da OS, de uma vez, sem mensalidade.

Proposta: `Titulo.contratoId` passa a ser **opcional**, e ganha um `ordemServicoId` opcional também — um título nasce **ou** de uma competência de contrato (como hoje), **ou** diretamente de uma OS concluída (caso novo). O valor, nesse segundo caso, vem do próprio orçamento aprovado que originou a OS. A grade de contas a receber e a matriz de inadimplência passam a mostrar os dois tipos sem distinção visual forçada — devedor, valor, vencimento, pago/não continuam os mesmos campos.

Isso **entra no Bloco A** (fundação), não pode esperar o Bloco B: sem isso, a MR Instalações não consegue emitir cobrança nenhuma no sistema desde o primeiro dia.

---

## 4. Telas e fluxos

| Tela/fluxo | O que muda |
|---|---|
| **Seletor de empresa ativa** | Novo, no cabeçalho. Só aparece pra quem tem acesso a mais de uma empresa (ou seja, só pra equipe Premura — a equipe local da Segplace nunca vê isso). Trocar de empresa é troca de contexto, **não exige novo login**. |
| **Cadastro de empresas** | Tela nova (lista + formulário), acessível só por quem é Premura com papel ADMIN. Os campos são os que hoje estão em "Dados da empresa". |
| **Módulos por empresa** | Tela nova (dentro do cadastro da empresa): checkboxes dos módulos disponíveis, liga/desliga por empresa. |
| **Usuários por empresa** | Evolução de `/usuarios`: ao editar um usuário local, escolher a quais empresas ele tem acesso e com qual papel em cada uma. Usuário Premura não passa por essa tela — o acesso dele já é automático. |
| **Todas as telas de negócio** (clientes, contratos, orçamentos, financeiro, auditoria, dashboard) | Passam a filtrar implicitamente pela empresa ativa da sessão — sem isso, dado de uma empresa vazaria pra outra. |
| **Contas a pagar** | Nova categoria "Folha de pagamento" no filtro/formulário; segundo campo de anexo (recibo assinado). |

---

## 5. Regras de negócio

- Usuário local só vê/grava dados da(s) empresa(s) em que tem `UsuarioEmpresa`; tentar acessar outra empresa por URL direta é bloqueado no servidor (mesmo padrão de guarda que já existe hoje pra módulo/papel).
- Usuário Premura (`ehPremura = true`) vê todas as empresas automaticamente, inclusive as cadastradas depois — zero reconfiguração manual quando entra cliente novo.
- Trocar de empresa ativa é instantâneo (contexto de sessão), não exige sair e entrar de novo.
- Módulo só aparece se a empresa tiver ele habilitado **e** o papel da pessoa naquela empresa permitir ver/editar.
- Trava de não-travamento: papel ADMIN sempre mantém acesso a "usuários" dentro da própria empresa (já existe); equivalente novo — um usuário Premura-ADMIN sempre mantém acesso ao cadastro de empresas e à concessão de acesso Premura, pra ninguém se trancar fora dessa tela.
- Isolamento é rígido: nenhuma consulta de negócio roda sem `where: { empresaId }` da empresa ativa — é a garantia de segurança desse bloco inteiro.
- Lançamento de "Folha de pagamento" segue as mesmas regras que já existem em Contas a Pagar (pago é consequência de pagamento registrado com data obrigatória, estorno auditável) — só com a categoria e o anexo extra novos.

---

## 6. Fora de escopo (explícito, para não virar retrabalho)

- Cálculo de folha de pagamento (INSS, IRRF, FGTS, férias, 13º, rescisão) — fica inteiramente com a Contabilidade terceirizada de cada empresa-cliente.
- eSocial ou qualquer integração trabalhista/governamental.
- Portal de acesso para o próprio funcionário ver seu holerite.
- Hierarquia entre empresas (matriz/filial, grupo econômico, consolidação contábil entre elas) — cada empresa-cliente é independente; só a equipe Premura é compartilhada.
- Cobrança da própria Premura às empresas-cliente pelo serviço prestado (pode virar uma fase futura, mas não foi pedido).
- Qualquer coisa que já estava fora de escopo no documento original (`escopo-sistema-fases.md` §9).

---

## 7. Decisões pendentes antes do kickoff

| # | Pergunta | Por que trava | Sugestão |
|---|---|---|---|
| 1 | Índices de reajuste (IPCA/IGP-M/INPC) ficam compartilhados entre empresas ou duplicados por empresa? | Afeta o schema de `IndiceReajuste`/`IndiceValor` | **Compartilhado** — são públicos e iguais pra todo mundo; duplicar é recadastro sem ganho |
| 2 | A trilha de auditoria da Premura deve ter uma visão consolidada entre empresas, ou só por empresa ativa? | Afeta tela de auditoria e eventual relatório da própria Premura | A definir com você — nenhuma das duas é mais trabalhosa, é questão de necessidade real |
| 3 | O cadastro de `Funcionario` (nome, cargo, ativo) é necessário já na primeira entrega, ou o texto livre no lançamento de contas a pagar resolve por enquanto? | Define se §3.5 entra completo ou simplificado na primeira versão | Sugestão: começar com texto livre (mais rápido), promover pra cadastro se o volume de funcionários justificar |
| 4 | Nome/CNPJ da(s) próxima(s) empresa(s) a entrar além da Segplace, pra já cadastrar de verdade na implantação | Não trava o desenho, só a carga de dados real | **Respondido**: MR Instalações Ltda ME, CNPJ 18.223.203/0001-02 |
| 5 | Quem hoje é "da Premura" entre os usuários que já existem (`admin/comercial/financeiro/tecnico@denisplace.com.br`)? Ficam como equipe local da Segplace, ou algum deles vira Premura? | Define a migração dos usuários atuais | Assumido no momento: todos continuam como equipe **local** da Segplace; contas Premura seriam criadas à parte |
| 6 | O modelo de planilha Google Sheets que a MR Instalações usa pra contas a receber — pode anexar o arquivo (ou um print/export) pra eu conferir se a grade de contas a receber atual já cobre os campos que ela usa? | Evita descobrir campo faltante só na homologação | Pendente de anexo |
| 7 | A MR Instalações usa contratos recorrentes pra algum serviço (ex.: manutenção periódica), ou é 100% pontual (orçamento → OS → cobrança única)? | Define se o módulo "Contratos" precisa estar habilitado pra ela, ou se só Orçamentos + Contas a receber (via §3.7) resolve | A confirmar — pelos 2 orçamentos enviados, parece 100% pontual |

---

## 8. Critérios de aceite

1. Login com um usuário marcado como Premura mostra o seletor de empresa com todas as cadastradas; trocar de empresa muda a tela inteira sem precisar sair e entrar de novo.
2. Login com um usuário local da Segplace continua idêntico a hoje: sem seletor, direto nos dados da Segplace — nenhuma mudança perceptível pra quem já usa.
3. Cadastrar uma empresa nova: nenhum dado de outra empresa aparece nela (clientes, contratos, financeiro todos zerados).
4. Dar acesso de um papel a um usuário local numa empresa nova não altera o acesso dele nas empresas que já tinha.
5. Lançar uma "Folha de pagamento" em Contas a Pagar com holerite e recibo assinado anexados, e ver aparecer na grade/relatório daquela empresa, na categoria certa, sem nenhum cálculo rodando.
6. Rodar a operação inteira da Segplace (contratos, cobrança, orçamentos, PDF, e-mail) depois da migração, sem regressão nenhuma no comportamento de hoje.
7. Na MR Instalações: aprovar um orçamento pontual (ex.: o modelo "Portão de correr"), gerar a OS, e emitir um título de cobrança **direto da OS**, sem precisar criar um Contrato artificial só pra isso.
8. Lançar em Contas a Pagar da MR Instalações um DARF e uma conta de internet, nas categorias novas, sem forçar nenhuma delas em "outro".

---

## 9. Sequência de implantação sugerida

1. **Bloco A — Fundação multiempresa.** `Empresa`, `empresaId` espalhado pelas tabelas de negócio, `UsuarioEmpresa` + `User.ehPremura`, seletor de empresa ativa, migração dos dados atuais da Segplace pro primeiro registro de `Empresa`, e **cobrança direta de OS pontual sem Contrato** (§3.7) — esse último entra aqui e não no Bloco B porque sem ele a MR Instalações não emite cobrança nenhuma desde o início. Maior parte do esforço: revisar toda consulta/action existente pra filtrar por empresa — não é o schema, é o volume de telas já construídas (clientes, condomínios, contratos, orçamentos, financeiro, auditoria, dashboard, PDF/e-mail).
2. **Bloco B — Módulos habilitáveis por empresa + Folha de pagamento + categorias genéricas.** `EmpresaModulo`, tela de gestão de módulos por empresa, categoria "Folha de pagamento" e as novas categorias administrativas (imposto, utilidade, boleto de fornecedor) em Contas a Pagar, com o anexo extra de recibo.
3. **Homologação com dado real.** Cadastrar a segunda empresa de verdade (a que tem funcionários) e rodar em paralelo por pelo menos uma competência antes de considerar fechado — mesmo critério de prudência que já foi usado na implantação original (`escopo-sistema-fases.md` §7: "não desligar o paralelo até bater o fechamento manual").

Sem estimativa de dias por enquanto — melhor medir depois que o Bloco A estiver desenhado em detalhe (schema + lista exata de telas/actions a revisar), já que o grosso do custo é volume de revisão, não complexidade nova.
