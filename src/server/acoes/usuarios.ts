'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { booleano, enumDe, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { autorizar } from '@/auth/guard';
import { prisma } from '../db';
import { registrarAuditoria } from '../auditoria';
import { colunaDuplicada } from '../erros';

const PAPEIS = ['ADMIN', 'COMERCIAL', 'FINANCEIRO', 'TECNICO'] as const;

/**
 * Gerenciamento de contas de acesso: só o administrador mexe aqui (módulo
 * `usuarios` na matriz de permissão). Duas travas evitam o sistema trancar
 * sozinho: ninguém desativa ou rebaixa o último administrador ativo, e a
 * senha só muda quando alguém digita uma nova — em branco mantém a atual.
 */
const schemaBase = z.object({
  nome: obrigatorio('Nome', 160),
  email: z
    .string({ required_error: 'E-mail é obrigatório.' })
    .trim()
    .toLowerCase()
    .email('E-mail inválido.'),
  papel: enumDe('Papel', PAPEIS),
  ativo: booleano(),
});

const schemaCriar = schemaBase.extend({
  senha: z
    .string({ required_error: 'Senha é obrigatória.' })
    .min(8, 'Senha deve ter pelo menos 8 caracteres.'),
});

const schemaEditar = schemaBase.extend({
  // Em branco = mantém a senha atual; só troca quando o administrador digita uma nova.
  senha: z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : v),
    z.string().min(8, 'Senha deve ter pelo menos 8 caracteres.').optional(),
  ),
});

async function contarAdminsAtivos(excluirId?: string): Promise<number> {
  return prisma.user.count({
    where: { papel: 'ADMIN', ativo: true, ...(excluirId ? { id: { not: excluirId } } : {}) },
  });
}

export async function criarUsuario(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('usuarios');
  if (!('usuario' in acesso)) return acesso;

  const resultado = validar(schemaCriar, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  try {
    const passwordHash = bcrypt.hashSync(resultado.dados.senha, 10);
    const usuario = await prisma.user.create({
      data: {
        nome: resultado.dados.nome,
        email: resultado.dados.email,
        papel: resultado.dados.papel as (typeof PAPEIS)[number],
        ativo: resultado.dados.ativo,
        passwordHash,
      },
    });
    await registrarAuditoria(acesso.usuario, {
      acao: 'usuario.criar',
      entidade: 'usuario',
      entidadeId: usuario.id,
      resumo: `Conta criada para ${usuario.nome} (${usuario.email}) com perfil ${usuario.papel}.`,
    });
    revalidatePath('/usuarios');
    redirect(`/usuarios/${usuario.id}?criado=1`);
  } catch (erro) {
    if (colunaDuplicada(erro) === 'email') {
      return { erros: { email: 'Já existe uma conta com este e-mail.' } };
    }
    throw erro;
  }
}

export async function salvarUsuario(id: string, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('usuarios');
  if (!('usuario' in acesso)) return acesso;

  const resultado = validar(schemaEditar, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) return { erros: { _: 'Usuário não encontrado.' } };

  const eraAdminAtivo = alvo.papel === 'ADMIN' && alvo.ativo;
  const continuaAdminAtivo = resultado.dados.papel === 'ADMIN' && resultado.dados.ativo;
  if (eraAdminAtivo && !continuaAdminAtivo) {
    const outrosAdmins = await contarAdminsAtivos(id);
    if (outrosAdmins === 0) {
      return {
        erros: {
          _: 'Esta é a única conta de administrador ativa: rebaixar, desativar ou trocar o perfil dela trancaria o sistema. Promova outra conta a administrador antes.',
        },
      };
    }
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        nome: resultado.dados.nome,
        email: resultado.dados.email,
        papel: resultado.dados.papel as (typeof PAPEIS)[number],
        ativo: resultado.dados.ativo,
        ...(resultado.dados.senha ? { passwordHash: bcrypt.hashSync(resultado.dados.senha, 10) } : {}),
      },
    });
    await registrarAuditoria(acesso.usuario, {
      acao: 'usuario.editar',
      entidade: 'usuario',
      entidadeId: id,
      resumo: `Dados atualizados${resultado.dados.senha ? '; senha redefinida' : ''}${
        alvo.papel !== resultado.dados.papel ? `; perfil ${alvo.papel} → ${resultado.dados.papel}` : ''
      }${alvo.ativo !== resultado.dados.ativo ? `; ${resultado.dados.ativo ? 'reativada' : 'desativada'}` : ''}.`,
    });
    revalidatePath('/usuarios');
    revalidatePath(`/usuarios/${id}`);
    return { mensagem: 'Usuário salvo.' };
  } catch (erro) {
    if (colunaDuplicada(erro) === 'email') {
      return { erros: { email: 'Já existe uma conta com este e-mail.' } };
    }
    throw erro;
  }
}
