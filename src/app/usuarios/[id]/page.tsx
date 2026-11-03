import { notFound } from 'next/navigation';
import { exigirPagina, sessaoAtual } from '@/auth/guard';
import { prisma } from '@/server/db';
import { salvarUsuario } from '@/server/acoes/usuarios';
import { Cabecalho } from '@/ui/pagina';
import { FormUsuario } from '../form';

export const metadata = { title: 'Usuário' };

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPagina('/usuarios/[id]');
  const eu = await sessaoAtual();
  const { id } = await params;

  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) notFound();

  return (
    <>
      <Cabecalho
        titulo={usuario.nome}
        descricao={usuario.email}
        voltar={{ href: '/usuarios', label: 'Voltar para usuários' }}
      />
      <div className="card max-w-2xl">
        <FormUsuario acao={salvarUsuario.bind(null, usuario.id)} registro={usuario} ehVocêMesmo={eu?.id === usuario.id} />
      </div>
    </>
  );
}
