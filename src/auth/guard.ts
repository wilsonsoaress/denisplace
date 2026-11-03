import { redirect } from 'next/navigation';
import type { Papel } from '@prisma/client';
import { auth } from '@/auth';
import { moduloDeHref, pode, type MapaPermissoes, type Modulo } from './perfis';

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** Resolvida no login a partir de `permissoes_perfil`; só atualiza na próxima sessão. */
  permissoes: MapaPermissoes;
};

export async function sessaoAtual(): Promise<UsuarioSessao | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    nome: session.user.name ?? '',
    email: session.user.email ?? '',
    papel: session.user.papel,
    permissoes: session.user.permissoes,
  };
}

/**
 * Guarda de leitura. Toda pagina e server component, então a checagem acontece no
 * servidor de verdade: esconder o link no menu é cortesia, não segurança.
 */
export async function exigirPagina(href: string): Promise<UsuarioSessao> {
  const usuario = await sessaoAtual();
  if (!usuario) redirect(`/login?depois=${encodeURIComponent(href)}`);
  if (!pode(usuario.permissoes, moduloDeHref(href))) {
    redirect(`/?semPermissao=${encodeURIComponent(moduloDeHref(href))}`);
  }
  return usuario;
}

/**
 * Guarda de escrita para server action. Diferente da de página: aqui devolvemos o
 * erro para o próprio formulário mostrar, em vez de mandar a pessoa para outro lugar.
 */
export async function autorizar(
  modulo: Modulo,
  perno: 'ver' | 'editar' = 'editar',
): Promise<{ usuario: UsuarioSessao } | { erros: { _: string } }> {
  const usuario = await sessaoAtual();
  if (!usuario) return { erros: { _: 'Sua sessão expirou. Entre novamente para gravar.' } };
  if (!pode(usuario.permissoes, modulo, perno)) {
    return {
      erros: {
        _: `O perfil ${usuario.papel.toLowerCase()} não tem permissão para ${
          perno === 'editar' ? 'alterar' : 'ver'
        } ${modulo}.`,
      },
    };
  }
  return { usuario };
}

/**
 * As telas de leitura mostram os campos de gravação só para quem pode gravar: a
 * recusa no servidor já protege o dado, e aqui evitamos o botão que só dá erro.
 */
export async function podeEditar(modulo: Modulo): Promise<boolean> {
  const usuario = await sessaoAtual();
  return !!usuario && pode(usuario.permissoes, modulo, 'editar');
}

/** Pedido de titular (LGPD) é caso de administrador: o mais alto perfil da matriz. */
export async function soAdmin(): Promise<{ usuario: UsuarioSessao } | { erros: { _: string } }> {
  const acesso = await autorizar('cadastros');
  if (!('usuario' in acesso)) return acesso;
  if (acesso.usuario.papel !== 'ADMIN') {
    return { erros: { _: 'Só o administrador atende um pedido de anonimização.' } };
  }
  return acesso;
}
