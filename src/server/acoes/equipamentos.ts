'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dataOpcional, enumDe, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { toDate } from '@/domain/dates';
import { prisma } from '../db';
import { colunaDuplicada } from '../erros';

const schema = z.object({
  modelo: obrigatorio('Modelo', 120),
  numeroSerie: obrigatorio('Número de série', 60),
  status: enumDe('Situação', ['ESTOQUE', 'INSTALADO', 'MANUTENCAO', 'BAIXADO'] as const),
  condominioId: opcional(40),
  unidadeId: opcional(40),
  garantiaAte: dataOpcional('Garantia até'),
  observacoes: opcional(1000),
});

export async function salvarEquipamento(
  id: string | null,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schema, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  if (d.status === 'INSTALADO' && !d.condominioId) {
    return { erros: { condominioId: 'Equipamento instalado precisa estar vinculado a um condomínio.' } };
  }
  if (d.unidadeId && !d.condominioId) {
    return { erros: { condominioId: 'Informe o condomínio antes de vincular a unidade.' } };
  }
  if (d.unidadeId) {
    const unidade = await prisma.unidade.findUnique({
      where: { id: d.unidadeId },
      select: { condominioId: true },
    });
    if (!unidade || unidade.condominioId !== d.condominioId) {
      return { erros: { unidadeId: 'A unidade escolhida não pertence ao condomínio informado.' } };
    }
  }

  const data = {
    modelo: d.modelo,
    numeroSerie: d.numeroSerie,
    status: d.status,
    condominioId: d.condominioId || null,
    // unidade so faz sentido dentro do condominio escolhido
    unidadeId: d.condominioId ? d.unidadeId || null : null,
    garantiaAte: d.garantiaAte ? toDate(d.garantiaAte) : null,
    observacoes: d.observacoes || null,
  };

  try {
    const equipamento =
      id === null
        ? await prisma.equipamento.create({ data })
        : await prisma.equipamento.update({ where: { id }, data });
    revalidatePath('/cadastros/equipamentos');
    redirect(`/cadastros/equipamentos/${equipamento.id}?salvo=1`);
  } catch (erro) {
    if (colunaDuplicada(erro)) {
      return { erros: { numeroSerie: 'Já existe equipamento com este número de série.' } };
    }
    throw erro;
  }
}
