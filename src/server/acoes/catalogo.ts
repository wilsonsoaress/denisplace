'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { booleano, decimal, decimalOpcional, enumDe, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { prisma } from '../db';
import { colunaDuplicada } from '../erros';

const schema = z.object({
  tipo: enumDe('Tipo', ['SERVICO', 'EQUIPAMENTO'] as const),
  nome: obrigatorio('Nome', 160),
  descricao: opcional(500),
  precoPublico: decimal('Preço público'),
  custoReferencia: decimalOpcional('Custo de referência').default('0'),
  unidadeCobranca: enumDe('Unidade de cobrança', ['MENSALIDADE', 'PONTO', 'HORA', 'PECA', 'DIARIA'] as const),
  indiceReajusteId: opcional(40),
  ativo: booleano(),
});

export async function salvarCatalogoItem(
  id: string | null,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schema, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;
  const preco = new Prisma.Decimal(d.precoPublico);
  const custo = new Prisma.Decimal(d.custoReferencia);
  if (custo.greaterThan(preco)) {
    return { erros: { custoReferencia: 'O custo de referência não pode ser maior que o preço público.' } };
  }

  const data = {
    tipo: d.tipo,
    nome: d.nome,
    descricao: d.descricao || null,
    precoPublico: preco,
    custoReferencia: custo,
    unidadeCobranca: d.unidadeCobranca,
    indiceReajusteId: d.indiceReajusteId || null,
    ativo: d.ativo,
  };

  try {
    const item =
      id === null
        ? await prisma.catalogoItem.create({ data })
        : await prisma.catalogoItem.update({ where: { id }, data });
    revalidatePath('/cadastros/catalogo');
    redirect(`/cadastros/catalogo/${item.id}?salvo=1`);
  } catch (erro) {
    if (colunaDuplicada(erro)) return { erros: { nome: 'Já existe item com esse nome no catálogo.' } };
    throw erro;
  }
}
