import { Resend } from 'resend';

/**
 * Envio de e-mail via Resend (API, sem SMTP pra configurar). Falha com
 * mensagem clara se a chave não estiver no ambiente, em vez de estourar um
 * erro genérico na tela — é o mesmo espírito de "sem integração" das outras
 * partes do sistema: a ausência de configuração não pode travar a tela.
 */
export class EmailNaoConfiguradoError extends Error {
  constructor() {
    super(
      'Envio de e-mail não configurado: defina RESEND_API_KEY e RESEND_FROM no ambiente (veja .env.example).',
    );
    this.name = 'EmailNaoConfiguradoError';
  }
}

export async function enviarEmailComAnexo(input: {
  para: string;
  assunto: string;
  corpoTexto: string;
  anexoNome: string;
  anexoBuffer: Buffer;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.RESEND_FROM;
  if (!apiKey || !remetente) throw new EmailNaoConfiguradoError();

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: remetente,
    to: input.para,
    subject: input.assunto,
    text: input.corpoTexto,
    replyTo: input.replyTo,
    attachments: [{ filename: input.anexoNome, content: input.anexoBuffer }],
  });
  if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`);
}
