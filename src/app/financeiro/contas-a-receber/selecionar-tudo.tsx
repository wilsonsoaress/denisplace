'use client';

/**
 * Sem isto, fechar o mes e um clique por titulo: a competencia inteira tem mais
 * linhas do que qualquer pessoa marca uma a uma sem voltar para a planilha.
 */
export function SelecionarTudo({ rotulo }: { rotulo: string }) {
  function alternar(evento: React.ChangeEvent<HTMLInputElement>) {
    const marcado = evento.target.checked;
    const form = evento.currentTarget.closest('form');
    if (!form) return;
    for (const el of form.querySelectorAll<HTMLInputElement>('input[name="ids"]')) el.checked = marcado;
  }
  return <input type="checkbox" onChange={alternar} className="size-4" aria-label={rotulo} title={rotulo} />;
}
