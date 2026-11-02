'use client';

import { Campo, Texto } from './form';
import { useBuscaCep } from './cep';

/**
 * Seção de endereço com CEP primeiro: ao sair do campo, o ViaCEP completa
 * logradouro, bairro, cidade e UF — cada formulário só decide a ordem/colunas
 * do grid em volta e se a cidade é obrigatória (condomínio é; cliente não).
 */
export function SecaoEndereco({
  cep,
  endereco,
  cidade,
  uf,
  cidadeObrigatoria,
  cidadeDica,
}: {
  cep?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  cidadeObrigatoria?: boolean;
  cidadeDica?: string;
}) {
  const { buscarCep, mensagem } = useBuscaCep();
  return (
    <>
      <Campo nome="cep" rotulo="CEP" dica={mensagem}>
        <Texto nome="cep" valor={cep} placeholder="00000-000" aoSair={buscarCep} />
      </Campo>
      <Campo nome="endereco" rotulo="Endereço" dica="Logradouro e bairro vêm do CEP; acrescente número e complemento.">
        <Texto nome="endereco" valor={endereco} />
      </Campo>
      <Campo nome="cidade" rotulo="Cidade" obrigatorio={cidadeObrigatoria} dica={cidadeDica}>
        <Texto nome="cidade" valor={cidade} obrigatorio={cidadeObrigatoria} />
      </Campo>
      <Campo nome="uf" rotulo="UF">
        <Texto nome="uf" valor={uf} />
      </Campo>
    </>
  );
}
