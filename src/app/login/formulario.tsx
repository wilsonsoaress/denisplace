'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Campo, Formulario, Texto, type EstadoForm } from '@/ui/form';

export default function FormularioLogin({ depois, expirado }: { depois: string; expirado: boolean }) {
  const [erro, setErro] = useState<string | null>(expirado ? 'Sua sessão expirou entre uma tela e outra.' : null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  async function enviar(_prev: EstadoForm, fd: FormData) {
    setErro(null);
    const resultado = await signIn('credentials', {
      email: String(fd.get('email') ?? ''),
      senha: String(fd.get('senha') ?? ''),
      redirect: false,
    });
    if (resultado?.error) {
      // Auth.js não diz se foi o e-mail ou a senha, e é de propósito.
      setErro('E-mail ou senha não conferem.');
      return null;
    }
    iniciar(async () => {
      router.replace(depois);
      router.refresh();
    });
    return null;
  }

  return (
    <Formulario acao={enviar} textoSubmit={pendente ? 'Entrando…' : 'Entrar'}>
      {erro ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {erro}
        </p>
      ) : null}
      <Campo nome="email" rotulo="E-mail" obrigatorio>
        <Texto nome="email" tipo="email" obrigatorio placeholder="nome@empresa.com" />
      </Campo>
      <Campo nome="senha" rotulo="Senha" obrigatorio>
        <Texto nome="senha" tipo="password" obrigatorio />
      </Campo>
    </Formulario>
  );
}
