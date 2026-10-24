import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Server Actions sao o caminho padrao para as mutacoes de cadastro e do contas a receber.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
