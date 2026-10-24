/**
 * Seed de demonstracao da F1.
 *
 * Reproduz os dados do mockup aprovado (5 condominios, 17 moradores, 13
 * competencias) usando o MESMO job de geracao de cobranca que roda em producao.
 * Se o job estiver errado, o seed mostra errado — e assim que ele e testado
 * antes de as telas existirem.
 */
import { PrismaClient } from '@prisma/client';
import { gerarCobranca } from '../src/server/cobranca/gerar';
import { addMonths, type Competencia } from '../src/domain/dates';

const prisma = new PrismaClient();

const HOJE = '2026-10-23';
const PRIMEIRA: Competencia = '2025-11-01';
const ULTIMA: Competencia = '2026-11-01';

const CONDOMINIOS = [
  { nome: 'Aurora', cidade: 'São Paulo', uf: 'SP', mensalidade: 4800 },
  { nome: 'Santa Cruz', cidade: 'São Paulo', uf: 'SP', mensalidade: 3600 },
  { nome: 'Vista Verde', cidade: 'Guarulhos', uf: 'SP', mensalidade: 5200 },
  { nome: 'Bella Itália', cidade: 'São Paulo', uf: 'SP', mensalidade: 2900 },
  { nome: 'Praia Azul', cidade: 'Santos', uf: 'SP', mensalidade: 6100 },
];

type MoradorDef = { codigo: string; condominio: string; valor: number; titular: string };

const MORADORES: MoradorDef[] = [
  { codigo: 'Casa 12 — bloco A', condominio: 'Aurora', valor: 189, titular: 'Ana Beatriz Rocha' },
  { codigo: 'Casa 14 — bloco A', condominio: 'Aurora', valor: 189, titular: 'Carlos Eduardo Lima' },
  { codigo: 'Apto 201 — bloco B', condominio: 'Aurora', valor: 215, titular: 'Fernanda Alvez' },
  { codigo: 'Apto 202 — bloco B', condominio: 'Aurora', valor: 215, titular: 'Gilberto Nunes' },
  { codigo: 'Casa 08 — bloco A', condominio: 'Santa Cruz', valor: 198, titular: 'Helena Prado' },
  { codigo: 'Apto 305 — bloco C', condominio: 'Santa Cruz', valor: 172, titular: 'Igor Vasconcelos' },
  { codigo: 'Apto 1102 — bloco A', condominio: 'Vista Verde', valor: 240, titular: 'Juliana Siqueira' },
  { codigo: 'Apto 1104 — bloco A', condominio: 'Vista Verde', valor: 240, titular: 'Kleber Antunes' },
  { codigo: 'Apto 702 — bloco B', condominio: 'Vista Verde', valor: 228, titular: 'Luciana Feltrin' },
  { codigo: 'Casa 21 — bloco D', condominio: 'Bella Itália', valor: 205, titular: 'Marcos Vinícius Teles' },
  { codigo: 'Apto 32 — bloco A', condominio: 'Bella Itália', valor: 180, titular: 'Natália Bastos' },
  { codigo: 'Apto 33 — bloco A', condominio: 'Bella Itália', valor: 180, titular: 'Otávio Rezende' },
  { codigo: 'Apto 511 — bloco C', condominio: 'Praia Azul', valor: 235, titular: 'Paula Kfouri' },
  { codigo: 'Apto 512 — bloco C', condominio: 'Praia Azul', valor: 235, titular: 'Quésia Duarte' },
  { codigo: 'Casa 31 — bloco E', condominio: 'Praia Azul', valor: 248, titular: 'Rogério Palma' },
  { codigo: 'Apto 204 — bloco B', condominio: 'Praia Azul', valor: 262, titular: 'Sandra Okamoto' },
  { codigo: 'Casa 03 — bloco A', condominio: 'Praia Azul', valor: 248, titular: 'Tiago Menezes' },
];

/** Isento por convenio: fica fora do calculo de adimplencia. */
const ISENTOS = new Set(['Casa 14 — bloco A']);

const FORMAS = ['PIX', 'TRANSFERENCIA', 'CHEQUE', 'CARTAO', 'DINHEIRO'] as const;

/** "Casa 12 — bloco A" -> { rotulo: "Casa 12", bloco: "bloco A" } */
function dividirCodigo(codigo: string): { rotulo: string; bloco: string | null } {
  const [rotulo, bloco] = codigo.split('—').map((s) => s.trim());
  return { rotulo: rotulo ?? codigo, bloco: bloco ?? null };
}

/** PRNG deterministico: rodar o seed duas vezes produz a mesma inadimplencia. */
function sorteio(de: string): number {
  let h = 2166136261;
  for (let i = 0; i < de.length; i++) {
    h ^= de.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function competencias(): Competencia[] {
  const out: Competencia[] = [];
  let cursor = PRIMEIRA;
  while (cursor <= ULTIMA) {
    out.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return out;
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function main() {
  console.log('limpando dados anteriores...');
  await prisma.emissaoLoteTitulo.deleteMany();
  await prisma.emissaoLote.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.titulo.deleteMany();
  await prisma.faturaItem.deleteMany();
  await prisma.fatura.deleteMany();
  await prisma.aditivoContratual.deleteMany();
  await prisma.contratoUnidade.deleteMany();
  await prisma.contratoItem.deleteMany();
  await prisma.ordemServico.deleteMany();
  await prisma.orcamentoItem.deleteMany();
  await prisma.orcamento.deleteMany();
  await prisma.equipamento.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.unidade.deleteMany();
  await prisma.condominio.deleteMany();
  await prisma.indiceValor.deleteMany();
  await prisma.indiceReajuste.deleteMany();
  await prisma.catalogoItem.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { nome: 'Denis Admin', email: 'admin@denisplace.com.br', papel: 'ADMIN', passwordHash: 'seed-sem-senha' },
      { nome: 'Renata Financeiro', email: 'financeiro@denisplace.com.br', papel: 'FINANCEIRO', passwordHash: 'seed-sem-senha' },
      { nome: 'Paulo Comercial', email: 'comercial@denisplace.com.br', papel: 'COMERCIAL', passwordHash: 'seed-sem-senha' },
    ],
  });

  const ipca = await prisma.indiceReajuste.create({ data: { sigla: 'IPCA', nome: 'IPCA — IBGE' } });
  await prisma.indiceReajuste.create({ data: { sigla: 'IGP-M', nome: 'IGP-M — FGV' } });
  await prisma.indiceReajuste.create({ data: { sigla: 'INPC', nome: 'INPC — IBGE' } });
  await prisma.indiceValor.createMany({
    data: competencias().map((c, i) => ({
      indiceId: ipca.id,
      competencia: d(c),
      variacaoMensal: i === 0 ? '0.10' : '0.35',
    })),
  });

  const combo = await prisma.catalogoItem.create({
    data: {
      tipo: 'SERVICO',
      nome: 'Aluguel de câmeras + manutenção',
      descricao: 'Locação dos equipamentos com manutenção preventiva inclusa',
      precoPublico: '4800.00',
      custoReferencia: '2100.00',
      unidadeCobranca: 'MENSALIDADE',
      indiceReajusteId: ipca.id,
    },
  });
  const aluguel = await prisma.catalogoItem.create({
    data: {
      tipo: 'EQUIPAMENTO',
      nome: 'Aluguel de equipamento Pináculo',
      descricao: 'Locação de câmera/interfonia por ponto',
      precoPublico: '189.00',
      custoReferencia: '72.00',
      unidadeCobranca: 'PONTO',
      indiceReajusteId: ipca.id,
    },
  });
  await prisma.catalogoItem.create({
    data: {
      tipo: 'SERVICO',
      nome: 'Manutenção mensal',
      precoPublico: '120.00',
      custoReferencia: '48.00',
      unidadeCobranca: 'MENSALIDADE',
      indiceReajusteId: ipca.id,
    },
  });
  await prisma.catalogoItem.create({
    data: { tipo: 'SERVICO', nome: 'Instalação pontual', precoPublico: '650.00', custoReferencia: '280.00', unidadeCobranca: 'HORA' },
  });

  let numeroContrato = 1;
  const condPorNome = new Map<string, { id: string; clienteId: string; contratoId: string }>();

  for (const [i, c] of CONDOMINIOS.entries()) {
    const cliente = await prisma.cliente.create({
      data: {
        tipo: 'PJ',
        nome: `Condomínio ${c.nome}`,
        documento: `12.345.678/0001-${String(10 + i).padStart(2, '0')}`,
        email: `sindico@${c.nome.toLowerCase().replace(/[^a-z]/g, '')}.com.br`,
        cidade: c.cidade,
        uf: c.uf,
        ehCondominio: true,
      },
    });

    const condominio = await prisma.condominio.create({
      data: {
        nome: c.nome,
        cidade: c.cidade,
        uf: c.uf,
        endereco: `Rua das Palmeiras, ${100 + i}`,
        sindicoNome: `Síndico ${c.nome}`,
        clienteId: cliente.id,
      },
    });

    // Contrato "mae": um unico boleto para o condominio inteiro.
    const contratoMae = await prisma.contrato.create({
      data: {
        numero: numeroContrato++,
        clienteId: cliente.id,
        condominioId: condominio.id,
        escopo: 'CONDOMINIO',
        inicio: d(PRIMEIRA),
        status: 'VIGENTE',
        vencimentoDia: 5,
        itens: {
          create: {
            catalogoItemId: combo.id,
            descricao: combo.nome,
            quantidade: '1.00',
            precoInicial: c.mensalidade.toFixed(2),
            precoAtual: c.mensalidade.toFixed(2),
            vigenciaDesde: d(PRIMEIRA),
            inicio: d(PRIMEIRA),
            periodicidade: 'ANUAL',
            proximoReajusteEm: d(addMonths(PRIMEIRA, 12)),
            indiceReajusteId: ipca.id,
          },
        },
      },
    });

    condPorNome.set(c.nome, { id: condominio.id, clienteId: cliente.id, contratoId: contratoMae.id });
  }

  for (const [i, m] of MORADORES.entries()) {
    const cond = condPorNome.get(m.condominio);
    if (!cond) throw new Error(`condominio ${m.condominio} nao encontrado`);
    const { rotulo, bloco } = dividirCodigo(m.codigo);

    const morador = await prisma.cliente.create({
      data: {
        tipo: 'PF',
        nome: m.titular,
        documento: `123.456.78${String(i).padStart(2, '0')}-00`,
        cidade: 'São Paulo',
        uf: 'SP',
      },
    });

    const unidade = await prisma.unidade.create({
      data: {
        condominioId: cond.id,
        codigo: m.codigo,
        bloco,
        numero: rotulo.replace(/\D/g, '') || null,
        titularId: morador.id,
      },
    });

    await prisma.contrato.create({
      data: {
        numero: numeroContrato++,
        clienteId: morador.id,
        condominioId: cond.id,
        parentContractId: cond.contratoId,
        escopo: 'UNIDADE',
        inicio: d(PRIMEIRA),
        status: 'VIGENTE',
        vencimentoDia: 5,
        itens: {
          create: {
            catalogoItemId: aluguel.id,
            descricao: `${aluguel.nome} — ${m.codigo}`,
            quantidade: '1.00',
            precoInicial: m.valor.toFixed(2),
            precoAtual: m.valor.toFixed(2),
            vigenciaDesde: d(PRIMEIRA),
            inicio: d(PRIMEIRA),
            periodicidade: 'ANUAL',
            indiceReajusteId: ipca.id,
          },
        },
        aderencias: {
          create: { unidadeId: unidade.id, moradorId: morador.id, desde: d(PRIMEIRA), situacao: 'ATIVA' },
        },
      },
    });
  }

  console.log('gerando as competencias pelo job de cobranca...');
  for (const comp of competencias()) {
    const r = await gerarCobranca(comp);
    console.log(`  ${comp}: ${r.criadas} criadas, ${r.jaExistiam} ja existiam, ${r.puladas.length} puladas`);
  }

  console.log('aplicando padrao de pagamento, boleto e NF...');
  const titulos = await prisma.titulo.findMany();
  let pagos = 0;
  let vencidos = 0;
  let isentos = 0;
  let futuros = 0;
  let nossoNumeroSeq = 0;

  for (const t of titulos) {
    const comp = t.competencia.toISOString().slice(0, 10);
    const mes = comp.slice(0, 7);
    const futuro = comp > HOJE.slice(0, 8) + '01';
    const s = sorteio(`${t.devedorNome}|${comp}`);
    const ehIsento = ISENTOS.has(t.devedorNome);
    const pago = !futuro && !ehIsento && s < 0.86;
    const diaPagamento = Math.min(28, 5 + Math.floor(s * 100));
    const forma = FORMAS[Math.floor(s * FORMAS.length)] ?? 'PIX';

    if (ehIsento) isentos++;
    if (futuro) futuros++;

    await prisma.titulo.update({
      where: { id: t.id },
      data: {
        isento: ehIsento,
        isentoMotivo: ehIsento ? 'Convênio com a administradora' : null,
        pago,
        pagoEm: pago ? d(`${mes}-${String(diaPagamento).padStart(2, '0')}`) : null,
        forma: pago ? forma : null,
        // Competencia futura ainda nao foi emitida: e o estado que o dashboard denuncia.
        boletoGerado: !futuro,
        boletoEmitidoEm: !futuro ? t.vencimento : null,
        nossoNumero: !futuro ? `${mes.replace(/-/g, '')}${String(++nossoNumeroSeq).padStart(6, '0')}` : null,
        nfEmitida: t.escopo === 'CONDOMINIO' && !futuro && s > 0.12,
        nfNumero: t.escopo === 'CONDOMINIO' && !futuro && s > 0.12 ? `NF-${mes.replace(/-/g, '')}` : null,
      },
    });

    if (pago) {
      pagos++;
      await prisma.pagamento.create({
        data: {
          tituloId: t.id,
          valor: t.valorOriginal,
          data: d(`${mes}-${String(diaPagamento).padStart(2, '0')}`),
          forma,
          // Nem todo recebimento tem comprovante anexado: o dashboard conta isso.
          comprovanteUrl: s < 0.6 ? `/storage/comprovantes/${t.numero}.pdf` : null,
        },
      });
    } else if (!futuro && !ehIsento) {
      vencidos++;
    }
  }

  const [clientes, condominios, unidades, contratos, faturas, titulosN] = await prisma.$transaction([
    prisma.cliente.count(),
    prisma.condominio.count(),
    prisma.unidade.count(),
    prisma.contrato.count(),
    prisma.fatura.count(),
    prisma.titulo.count(),
  ]);

  console.log(
    [
      '',
      'seed concluido:',
      `  clientes         ${clientes}`,
      `  condominios      ${condominios}`,
      `  unidades         ${unidades}`,
      `  contratos        ${contratos}`,
      `  faturas          ${faturas}`,
      `  titulos          ${titulosN}`,
      `    pagos          ${pagos}`,
      `    vencidos       ${vencidos}`,
      `    isentos        ${isentos}`,
      `    a vencer       ${futuros}`,
      `  "hoje" do sistema ${HOJE}`,
    ].join('\n'),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
