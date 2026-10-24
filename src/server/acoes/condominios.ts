'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { documento, email, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { prisma } from '../db';
import { colunaDuplicada } from '../erros';

const schemaCondominio = z.object({
  nome: obrigatorio('Nome do condomínio', 160),
  cnpj: documento('CNPJ'),
  endereco: opcional(200),
  cidade: opcional(80),
  uf: opcional(2),
  cep: opcional(10),
  sindicoNome: opcional(160),
  sindicoEmail: email(),
  sindicoTelefone: opcional(40),
  administradora: opcional(160),
  clienteId: opcional(40),
});

const schemaUnidade = z.object({
  codigo: obrigatorio('Código da unidade', 60),
  bloco: opcional(40),
  numero: opcional(40),
  titularId: opcional(40),
});

export async function salvarCondominio(
  id: string | null,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaCondominio, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;
  const data = {
    nome: d.nome,
    cnpj: d.cnpj || null,
    endereco: d.endereco || null,
    cidade: d.cidade || null,
    uf: d.uf || null,
    cep: d.cep || null,
    sindicoNome: d.sindicoNome || null,
    sindicoEmail: d.sindicoEmail || null,
    sindicoTelefone: d.sindicoTelefone || null,
    administradora: d.administradora || null,
    clienteId: d.clienteId || null,
  };

  try {
    const condominio =
      id === null
        ? await prisma.condominio.create({ data })
        : await prisma.condominio.update({ where: { id }, data });
    revalidatePath('/cadastros/condominios');
    redirect(`/cadastros/condominios/${condominio.id}?salvo=1`);
  } catch (erro) {
    const coluna = colunaDuplicada(erro);
    if (coluna) {
      return {
        erros: {
          [coluna === 'cnpj' ? 'cnpj' : 'nome']:
            coluna === 'cnpj'
              ? 'Já existe condomínio com esse CNPJ.'
              : 'Já existe condomínio com esse nome na mesma cidade.',
        },
      };
    }
    throw erro;
  }
}

export async function salvarUnidade(
  condominioId: string,
  unidadeId: string | null,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaUnidade, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;
  const data = {
    codigo: d.codigo,
    bloco: d.bloco || null,
    numero: d.numero || null,
    titularId: d.titularId || null,
  };

  try {
    if (unidadeId === null) {
      await prisma.unidade.create({ data: { ...data, condominioId } });
    } else {
      await prisma.unidade.update({ where: { id: unidadeId }, data });
    }
  } catch (erro) {
    if (colunaDuplicada(erro)) return { erros: { codigo: 'Essa unidade já está cadastrada neste condomínio.' } };
    throw erro;
  }

  revalidatePath(`/cadastros/condominios/${condominioId}`);
  return { mensagem: `Unidade ${data.codigo} salva.` };
}

export async function alternarUnidade(condominioId: string, unidadeId: string, ativa: boolean) {
  await prisma.unidade.update({ where: { id: unidadeId }, data: { ativa } });
  revalidatePath(`/cadastros/condominios/${condominioId}`);
}
