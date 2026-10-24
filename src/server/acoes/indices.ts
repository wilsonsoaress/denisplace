'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dataISO, decimalComSinal, obrigatorio, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { toDate, competencia } from '@/domain/dates';
import { prisma } from '../db';
import { colunaDuplicada } from '../erros';

const schemaIndice = z.object({
  sigla: obrigatorio('Sigla', 12),
  nome: obrigatorio('Nome', 120),
});

export async function salvarIndice(
  id: string | null,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaIndice, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const data = { sigla: resultado.dados.sigla.toUpperCase(), nome: resultado.dados.nome };
  try {
    const indice =
      id === null
        ? await prisma.indiceReajuste.create({ data })
        : await prisma.indiceReajuste.update({ where: { id }, data });
    revalidatePath('/cadastros/indices');
    redirect(`/cadastros/indices/${indice.id}?salvo=1`);
  } catch (erro) {
    if (colunaDuplicada(erro)) return { erros: { sigla: 'Já existe índice com esta sigla.' } };
    throw erro;
  }
}

const schemaValor = z.object({
  competencia: dataISO('Competência'),
  variacaoMensal: decimalComSinal('Variação mensal'),
});

export async function salvarValorIndice(
  indiceId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaValor, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const comp = competencia(resultado.dados.competencia);
  const valor = new Prisma.Decimal(resultado.dados.variacaoMensal);
  const chave = toDate(comp);
  await prisma.indiceValor.upsert({
    where: { indiceId_competencia: { indiceId, competencia: chave } },
    create: { indiceId, competencia: chave, variacaoMensal: valor },
    update: { variacaoMensal: valor },
  });

  revalidatePath(`/cadastros/indices/${indiceId}`);
  return { mensagem: `Índice ${comp.slice(0, 7)} registrado.` };
}
