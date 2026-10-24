import { Prisma } from '@prisma/client';

/**
 * Nome da coluna que violou uma unique do banco, ou null se o erro nao foi P2002.
 * O form nao deve prever duplicidade: o banco ja e a autoridade, e mostramos a
 * violacao como erro do campo correspondente.
 */
export function colunaDuplicada(erro: unknown): string | null {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== 'P2002') return null;
  const alvo = (erro.meta?.target as unknown[] | undefined)?.[0];
  return typeof alvo === 'string' ? alvo : '_';
}
