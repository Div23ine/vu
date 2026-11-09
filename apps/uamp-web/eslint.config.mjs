import nextConfig from '@vunvault/config/eslint.next.mjs';

export default [
  { ignores: ['next-env.d.ts', '.next/**', '.open-next/**'] },
  ...nextConfig,
];