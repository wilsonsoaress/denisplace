'use client';

import { useState } from 'react';

type RespostaViaCep = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export type StatusCep = 'ocioso' | 'buscando' | 'ok' | 'nao_encontrado' | 'falhou';

export const MENSAGEM_STATUS_CEP: Record<StatusCep, string | undefined> = {
  ocioso: 'Preenchido o CEP, o endereço abaixo é completado automaticamente.',
  buscando: 'Consultando o CEP…',
  ok: 'Endereço completado pelo CEP. Confira e acrescente número e complemento.',
  nao_encontrado: 'CEP não encontrado. Preencha o endereço manualmente.',
  falhou: 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.',
};

/**
 * Busca de CEP via ViaCEP (sem chave, API pública) para completar logradouro,
 * bairro, cidade e UF. Não é integração de verdade — é so conveniência de
 * digitação: os campos continuam editáveis se a consulta falhar ou o CEP vier
 * de fora do Brasil. Preenche pelo `name` dentro do MESMO form, como o resto
 * do app já faz (ver `SelecionarTudo`), em vez de exigir refs por campo.
 */
export function useBuscaCep() {
  const [status, setStatus] = useState<StatusCep>('ocioso');

  async function buscarCep(evento: React.FocusEvent<HTMLInputElement>) {
    const digitos = evento.currentTarget.value.replace(/\D/g, '');
    const form = evento.currentTarget.closest('form');
    if (!form || digitos.length !== 8) return;

    setStatus('buscando');
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      if (!resposta.ok) {
        setStatus('falhou');
        return;
      }
      const dados = (await resposta.json()) as RespostaViaCep;
      if (dados.erro) {
        setStatus('nao_encontrado');
        return;
      }

      const preencher = (nomeCampo: string, valor: string | undefined) => {
        if (!valor) return;
        const campo = form.querySelector<HTMLInputElement>(`[name="${nomeCampo}"]`);
        if (!campo) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(campo, valor);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      };
      preencher('endereco', [dados.logradouro, dados.bairro].filter(Boolean).join(', '));
      preencher('cidade', dados.localidade);
      preencher('uf', dados.uf);
      setStatus('ok');
    } catch {
      setStatus('falhou');
    }
  }

  return { status, buscarCep, mensagem: MENSAGEM_STATUS_CEP[status] };
}
