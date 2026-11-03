import type { User } from '@prisma/client';
import { Campo, Check, Escolha, Formulario, Texto, type EstadoForm } from '@/ui/form';
import { PAPEIS_LABEL } from '@/auth/perfis';
import { opcoes } from '@/lib/rotulos';

export function FormUsuario({
  acao,
  registro,
  ehVocêMesmo = false,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: User;
  /** Alerta quando o administrador está editando a própria conta: desativar ou rebaixar aqui tranca o próprio acesso. */
  ehVocêMesmo?: boolean;
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar alterações' : 'Criar usuário'}>
      {ehVocêMesmo ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta é a sua própria conta: se você se desativar, trocar seu perfil para um que não seja administrador, ou
          errar a senha aqui, pode perder o próprio acesso.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" rotulo="Nome" obrigatorio>
          <Texto nome="nome" valor={registro?.nome} obrigatorio />
        </Campo>
        <Campo nome="email" rotulo="E-mail" obrigatorio dica="É o login: precisa ser único.">
          <Texto nome="email" tipo="email" valor={registro?.email} obrigatorio />
        </Campo>
        <Campo
          nome="papel"
          rotulo="Perfil"
          obrigatorio
          dica="Define o que a pessoa pode ver e editar em cada módulo."
        >
          <Escolha nome="papel" valor={registro?.papel ?? 'TECNICO'} opcoes={opcoes(PAPEIS_LABEL)} obrigatorio />
        </Campo>
        <Campo nome="ativo" rotulo="Situação">
          <div className="pt-2">
            <Check nome="ativo" rotulo="Ativo (consegue fazer login)" valor={registro?.ativo ?? true} />
          </div>
        </Campo>
        <Campo
          nome="senha"
          rotulo={registro ? 'Nova senha' : 'Senha'}
          obrigatorio={!registro}
          dica={registro ? 'Deixe em branco para manter a senha atual. Mínimo 8 caracteres.' : 'Mínimo 8 caracteres.'}
        >
          <Texto nome="senha" tipo="password" obrigatorio={!registro} placeholder={registro ? '••••••••' : undefined} />
        </Campo>
      </div>
      {registro?.ultimoAcessoEm ? (
        <p className="text-xs text-slate-500">
          Último acesso: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(registro.ultimoAcessoEm)}
        </p>
      ) : registro ? (
        <p className="text-xs text-slate-500">Ainda não fez login.</p>
      ) : null}
    </Formulario>
  );
}
