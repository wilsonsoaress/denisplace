'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { email, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { soAdmin } from '@/auth/guard';
import { prisma } from '../db';
import { registrarAuditoria } from '../auditoria';

/**
 * Singleton: uma única linha guarda os dados que aparecem no cabeçalho do PDF
 * do orçamento e no remetente do e-mail. Sem registro ainda, `obterDadosEmpresa`
 * devolve null e a tela (e o PDF) avisam que falta cadastrar.
 */
export async function obterDadosEmpresa() {
  return prisma.dadosEmpresa.findFirst({ orderBy: { criadoEm: 'asc' } });
}

const schema = z.object({
  nome: obrigatorio('Razão social', 160),
  nomeFantasia: opcional(160),
  cnpj: opcional(20),
  email: email(),
  telefone: opcional(40),
  endereco: opcional(200),
  cidade: opcional(80),
  uf: opcional(2),
  cep: opcional(10),
  site: opcional(200),
  logoUrl: opcional(500),
  observacoesRodape: opcional(1000),
});

/** Só admin edita: os dados viram cabeçalho de PDF e remetente de e-mail da empresa inteira. */
export async function salvarDadosEmpresa(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await soAdmin();
  if (!('usuario' in acesso)) return acesso;

  const resultado = validar(schema, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  const registro = {
    nome: d.nome,
    nomeFantasia: d.nomeFantasia || null,
    cnpj: d.cnpj || null,
    email: d.email || null,
    telefone: d.telefone || null,
    endereco: d.endereco || null,
    cidade: d.cidade || null,
    uf: d.uf || null,
    cep: d.cep || null,
    site: d.site || null,
    logoUrl: d.logoUrl || null,
    observacoesRodape: d.observacoesRodape || null,
  };

  const atual = await obterDadosEmpresa();
  if (atual) {
    await prisma.dadosEmpresa.update({ where: { id: atual.id }, data: registro });
  } else {
    await prisma.dadosEmpresa.create({ data: registro });
  }

  await registrarAuditoria(acesso.usuario, {
    acao: 'empresa.salvar',
    entidade: 'dadosEmpresa',
    entidadeId: atual?.id ?? 'novo',
    resumo: `dados da empresa atualizados (${d.nome})`,
  });
  revalidatePath('/cadastros/empresa');
  return { mensagem: 'Dados da empresa salvos. Já valem para o próximo PDF e e-mail de orçamento.' };
}
