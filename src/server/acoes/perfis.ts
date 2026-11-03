'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { autorizar } from '@/auth/guard';
import { MODULOS_SISTEMA, PAPEIS_SISTEMA, papelTravado, type Perno } from '@/auth/perfis';
import type { EstadoForm } from '@/ui/form';
import { prisma } from '../db';
import { registrarAuditoria } from '../auditoria';
import { buscarMatrizCompleta, MODULO_PARA_DB, PERNO_PARA_DB } from '../permissoes';

const schemaMatriz = z.object(
  Object.fromEntries(
    PAPEIS_SISTEMA.flatMap((papel) =>
      MODULOS_SISTEMA.map((modulo) => [`${papel}__${modulo}`, z.enum(['nenhum', 'ver', 'editar']).optional()]),
    ),
  ),
);

/**
 * Grava a matriz inteira de uma vez (grid de selects). O par ADMIN+usuarios é
 * sempre forçado a 'editar', mesmo que o formulário mande outra coisa: é a
 * trava que impede o administrador de trancar o próprio acesso a esta tela.
 */
export async function salvarMatrizPermissoes(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('usuarios');
  if (!('usuario' in acesso)) return acesso;

  const bruto: Record<string, string> = {};
  for (const [chave, valor] of fd.entries()) {
    if (typeof valor === 'string') bruto[chave] = valor;
  }
  const resultado = schemaMatriz.safeParse(bruto);
  if (!resultado.success) {
    return { erros: { _: 'Formulário de permissões inválido.' } };
  }
  const dados = resultado.data;

  const antes = await buscarMatrizCompleta();
  const mudancas: string[] = [];

  await prisma.$transaction(
    PAPEIS_SISTEMA.flatMap((papel) =>
      MODULOS_SISTEMA.map((modulo) => {
        const travado = papelTravado(papel, modulo);
        const pedido = dados[`${papel}__${modulo}` as keyof typeof dados] as Perno | undefined;
        const nivel: Perno = travado ? 'editar' : pedido ?? 'nenhum';
        if (antes[papel][modulo] !== nivel) {
          mudancas.push(`${papel}.${modulo}: ${antes[papel][modulo]} → ${nivel}`);
        }
        return prisma.permissaoPerfil.upsert({
          where: { papel_modulo: { papel, modulo: MODULO_PARA_DB[modulo] } },
          update: { nivel: PERNO_PARA_DB[nivel] },
          create: { papel, modulo: MODULO_PARA_DB[modulo], nivel: PERNO_PARA_DB[nivel] },
        });
      }),
    ),
  );

  if (mudancas.length > 0) {
    await registrarAuditoria(acesso.usuario, {
      acao: 'perfil.permissoes',
      entidade: 'permissao_perfil',
      entidadeId: 'matriz',
      resumo: `Permissões alteradas: ${mudancas.join('; ')}. Vale a partir do próximo login de quem já está na sessão.`,
    });
  }
  revalidatePath('/usuarios/perfis');
  revalidatePath('/');
  return {
    mensagem:
      mudancas.length > 0
        ? 'Permissões salvas. Quem já está logado só vê a mudança depois de sair e entrar de novo.'
        : 'Nada mudou.',
  };
}
