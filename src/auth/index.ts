import NextAuth, { type DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import type { Papel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db';

declare module 'next-auth' {
  interface Session {
    user: { id: string; papel: Papel } & DefaultSession['user'];
  }
  interface User {
    id: string;
    papel: Papel;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    papel?: Papel;
  }
}

/**
 * Sessao em JWT assinado (sem tabela de sessao no banco): o sistema e uma
 * intranet de poucas pessoas e um token de 8 horas cobre o dia de trabalho.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      async authorize(credenciais) {
        const email = typeof credenciais?.email === 'string' ? credenciais.email.trim().toLowerCase() : '';
        const senha = typeof credenciais?.senha === 'string' ? credenciais.senha : '';
        if (!email || !senha) return null;

        const usuario = await prisma.user.findUnique({ where: { email } });
        // Mensagem identica para e-mail inexistente e senha errada: a tela de login
        // nao pode virar um catálogo de quem trabalha na empresa.
        if (!usuario?.ativo) return null;
        if (!(await bcrypt.compare(senha, usuario.passwordHash))) return null;

        await prisma.user.update({ where: { id: usuario.id }, data: { ultimoAcessoEm: new Date() } });
        return { id: usuario.id, name: usuario.nome, email: usuario.email, papel: usuario.papel };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.papel = user.papel;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id ?? '';
      session.user.papel = (token.papel ?? 'TECNICO') as Papel;
      return session;
    },
  },
});
