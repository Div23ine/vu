import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@vunvault/contracts', '@vunvault/lib'],
};

export default nextConfig;

if (process.env.NODE_ENV !== 'production' && process.env.VV_SKIP_CF_DEV !== '1') {
  void initOpenNextCloudflareForDev();
}