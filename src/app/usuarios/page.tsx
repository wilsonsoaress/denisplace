import Link from 'next/link';
import { exigirPagina, sessaoAtual } from '@/auth/guard';
import { prisma } from '@/server/db';
import { Cabecalho, Vazio } from '@/ui/pagina';
import { PAPEIS_LABEL } from '@/auth/perfis';

export const metadata = { title: 'Usuários' };

export default async function UsuariosPage() {
  await exigirPagina('/usuarios');
  const eu = await sessaoAtual();

  const usuarios = await prisma.user.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  });

  return (
    <>
      <Cabecalho
        titulo="Usuários"
        descricao="Contas de acesso ao sistema: quem entra, com qual perfil e se ainda pode logar. Só administrador mexe aqui."
        acoes={
          <>
            <Link href="/usuarios/perfis" className="btn">
              Gerenciar perfis
            </Link>
            <Link href="/usuarios/novo" className="btn btn-primary">
              Novo usuário
            </Link>
          </>
        }
      />

      {usuarios.length === 0 ? (
        <Vazio>Nenhum usuário cadastrado.</Vazio>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Último acesso</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/usuarios/${u.id}`} className="font-medium text-blue-800 hover:underline">
                      {u.nome}
                    </Link>
                    {eu?.id === u.id ? <span className="chip chip-free ml-2">você</span> : null}
                  </td>
                  <td>{u.email}</td>
                  <td>{PAPEIS_LABEL[u.papel]}</td>
                  <td className="text-sm text-slate-600">
                    {u.ultimoAcessoEm
                      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(u.ultimoAcessoEm)
                      : '— nunca —'}
                  </td>
                  <td>
                    <span className={`chip ${u.ativo ? 'chip-ok' : 'chip-free'}`}>{u.ativo ? 'ativo' : 'inativo'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
