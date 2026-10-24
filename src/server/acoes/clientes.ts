'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { booleano, documento, email, enumDe, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { autorizar, soAdmin } from '@/auth/guard';
import { prisma } from '../db';
import { registrarAuditoria } from '../auditoria';
import { colunaDuplicada } from '../erros';

const schema = z.object({
  tipo: enumDe('Tipo de pessoa', ['PF', 'PJ'] as const),
  nome: obrigatorio('Nome', 160),
  documento: documento(),
  email: email(),
  telefone: opcional(40),
  endereco: opcional(200),
  cidade: opcional(80),
  uf: opcional(2),
  cep: opcional(10),
  ehCondominio: booleano(),
  observacoes: opcional(2000),
  ativo: booleano(),
});


async function gravar(id: string | null, dados: z.infer<typeof schema>) {
  const registro = {
    tipo: dados.tipo,
    nome: dados.nome,
    documento: dados.documento || null,
    email: dados.email || null,
    telefone: dados.telefone || null,
    endereco: dados.endereco || null,
    cidade: dados.cidade || null,
    uf: dados.uf || null,
    cep: dados.cep || null,
    ehCondominio: dados.ehCondominio,
    observacoes: dados.observacoes || null,
    ativo: dados.ativo,
  };
  if (id === null) return prisma.cliente.create({ data: registro });
  return prisma.cliente.update({ where: { id }, data: registro });
}

/** id null = criacao. Bind parcial pela pagina; useActionState chama (prev, formData). */
export async function salvarCliente(id: string | null, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schema, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  try {
    const cliente = await gravar(id, resultado.dados);
    revalidatePath('/cadastros/clientes');
    redirect(`/cadastros/clientes/${cliente.id}?salvo=1`);
  } catch (erro) {
    const coluna = colunaDuplicada(erro);
    if (coluna) {
      return {
        erros: {
          [coluna === 'documento' ? 'documento' : 'nome']:
            coluna === 'documento'
              ? 'Já existe cliente com este CPF/CNPJ.'
              : 'Este nome já está cadastrado.',
        },
      };
    }
    throw erro;
  }
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<void> {
  const acesso = await autorizar('cadastros');
  if (!('usuario' in acesso)) return;
  await prisma.cliente.update({ where: { id }, data: { ativo } });
  await registrarAuditoria(acesso.usuario, {
    acao: ativo ? 'cliente.ativar' : 'cliente.desativar',
    entidade: 'cliente',
    entidadeId: id,
    resumo: ativo ? 'Cliente reativado' : 'Cliente desativado',
  });
  revalidatePath('/cadastros/clientes');
}

const mensagemLgpd = 'Digite SIM para confirmar: a anonimação não pode ser desfeita.';

const schemaLgpd = z.object({
  motivo: obrigatorio('Motivo do pedido LGPD', 500),
  confirmar: z
    .string({ required_error: mensagemLgpd })
    .refine((v) => v === 'SIM', mensagemLgpd),
});

/**
 * Anonimizacao LGPD do morador: os dados pessoais somem, o histórico de cobrança
 * fica. Isso segura porque o título desnormaliza o nome do devedor na emissão
 * (debtor_name) e a trilha de auditoria guarda o evento.
 */
export async function anonimizarCliente(id: string, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await soAdmin();
  if (!('usuario' in acesso)) return acesso;

  const resultado = validar(schemaLgpd, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      contratos: { where: { status: { in: ['VIGENTE', 'SUSPENSO', 'RASCUNHO'] } }, select: { id: true, numero: true } },
      aderencias: { where: { situacao: 'ATIVA' }, select: { id: true } },
      unidadesTitular: { where: { ativa: true }, select: { id: true, codigo: true } },
    },
  });
  if (!cliente) return { erros: { motivo: 'Cliente não encontrado.' } };

  const impedimentos = [
    cliente.contratos.length > 0 ? `contrato(s) ativo(s) nº ${cliente.contratos.map((c) => c.numero).join(', ')}` : null,
    cliente.aderencias.length > 0 ? `${cliente.aderencias.length} adesão(ões) de unidade em aberto` : null,
    cliente.unidadesTitular.length > 0 ? `titular de unidade(s) ativa(s): ${cliente.unidadesTitular.map((u) => u.codigo).join(', ')}` : null,
  ].filter((x): x is string => x !== null);
  if (impedimentos.length > 0) {
    return {
      erros: {
        motivo: `Ainda há vínculo vivo (${impedimentos.join('; ')}). Encerre o contrato e a adesão antes de anonimizar: sem o nome, a cobrança não sabe de quem é.`,
      },
    };
  }

  const apelido = `Morador anonimizado (pedido LGPD) ${cliente.id.slice(-5)}`;
  await prisma.cliente.update({
    where: { id },
    data: {
      nome: apelido,
      documento: null,
      email: null,
      telefone: null,
      endereco: null,
      cidade: null,
      uf: null,
      cep: null,
      observacoes: null,
      ativo: false,
    },
  });
  await registrarAuditoria(acesso.usuario, {
    acao: 'cliente.anonimizar',
    entidade: 'cliente',
    entidadeId: id,
    resumo: `Dados pessoais apagados por pedido LGPD (${resultado.dados.motivo}); o histórico de cobrança foi preservado.`,
  });
  revalidatePath('/cadastros/clientes');
  revalidatePath(`/cadastros/clientes/${id}`);
  return { mensagem: 'Cliente anonimizado: sobrou apenas o apelido, os títulos e adesões históricos continuam iguais.' };
}
