import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@vunvault/contracts', '@vunvault/lib'],
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' }
      ]
    }];
  }
};

export default nextConfig;

if (process.env.NODE_ENV !== 'production' && process.env.VV_SKIP_CF_DEV !== '1') {
  void initOpenNextCloudflareForDev();
}