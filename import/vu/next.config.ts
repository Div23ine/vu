import type { OpenNextConfig } from '@opennextjs/aws/types/open-next';

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
    },
  },
  // 👇 Explicitly tell OpenNext's esbuild bundler to ignore these packages
  dangerous: {
    enableCacheInterception: false,
  },
};

export default config;
