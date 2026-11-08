import { describe, expect, it } from 'vitest';
import type { DockerNetwork } from './docker-pod-runner';
import { NftHostFirewallBroker, type NftCommandPort } from './nft-firewall-broker';

const NETWORK: DockerNetwork = {
  id: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  name: 'vv-scan-job-4471-a1',
};

class FakeNft implements NftCommandPort {
  calls: { args: string[]; input?: string }[] = [];
  inputRules = '';
  forwardRules = '';
  existingChains = new Set<string>();

  async run(args: string[], input?: string): Promise<string> {
    this.calls.push({ args, ...(input === undefined ? {} : { input }) });
    const joined = args.join(' ');
    if (joined === 'list table inet vv_scan') return '';
    if (joined === 'list chain inet vv_scan input') return '';
    if (joined === 'list chain inet vv_scan forward') return '';
    if (args[0] === '-a' && args.at(-1) === 'input') return this.inputRules;
    if (args[0] === '-a' && args.at(-1) === 'forward') return this.forwardRules;
    if (args[0] === 'list' && args.at(-1)?.startsWith('in_')) {
      if (!this.existingChains.has(args.at(-1) ?? '')) throw new Error('missing chain');
      return 'chain exists';
    }
    if (args[0] === 'list' && args.at(-1)?.startsWith('fw_')) {
      if (!this.existingChains.has(args.at(-1) ?? '')) throw new Error('missing chain');
      return 'chain exists';
    }
    if (args[0] === '-f' && input !== undefined) {
      for (const match of input.matchAll(/add chain inet vv_scan (in_[a-f0-9]+|fw_[a-f0-9]+)/g)) {
        this.existingChains.add(match[1] ?? '');
      }
      return '';
    }
    return '';
  }
}

describe('NftHostFirewallBroker', () => {
  it('installs per-network input and forwarding restrictions for only public IPs', async () => {
    const nft = new FakeNft();
    const broker = new NftHostFirewallBroker(nft, async (name) => name === 'br-0123456789ab');

    await broker.install(NETWORK, ['93.184.216.34', '8.8.8.8']);

    const install = nft.calls.find((call) => call.args[0] === '-f' && call.input?.includes('add rule'));
    expect(install?.input).toContain('iifname "br-0123456789ab" jump in_0123456789ab');
    expect(install?.input).toContain('ip daddr { 93.184.216.34, 8.8.8.8 } accept');
    expect(install?.input).toContain('ct state established,related accept');
    expect(install?.input).toContain('iifname "br-0123456789ab" drop');
    expect(install?.input).toContain('oifname "br-0123456789ab" drop');
  });

  it('refuses non-public addresses before writing any rules', async () => {
    const nft = new FakeNft();
    const broker = new NftHostFirewallBroker(nft, async () => true);

    await expect(broker.install(NETWORK, ['169.254.169.254'])).rejects.toThrow(/non-public/);
    expect(nft.calls).toHaveLength(0);
  });

  it('fails closed when the expected Docker bridge does not exist', async () => {
    const nft = new FakeNft();
    const broker = new NftHostFirewallBroker(nft, async () => false);

    await expect(broker.install(NETWORK, ['93.184.216.34'])).rejects.toThrow(/bridge interface/);
    expect(nft.calls).toHaveLength(0);
  });

  it('removes only rules tagged with the requested Docker network ID', async () => {
    const nft = new FakeNft();
    nft.inputRules = 'iifname "br-0123456789ab" jump in_0123456789ab comment "vvscan:' + NETWORK.id + '" # handle 10';
    nft.forwardRules = 'iifname "br-0123456789ab" jump fw_0123456789ab comment "vvscan:' + NETWORK.id + '" # handle 20\n' +
      'oifname "br-0123456789ab" jump fw_0123456789ab comment "vvscan:' + NETWORK.id + '" # handle 21';
    nft.existingChains.add('in_0123456789ab');
    nft.existingChains.add('fw_0123456789ab');
    const broker = new NftHostFirewallBroker(nft, async () => true);

    await broker.remove(NETWORK);

    const deletion = nft.calls.at(-1)?.input ?? '';
    expect(deletion).toContain('delete rule inet vv_scan input handle 10');
    expect(deletion).toContain('delete rule inet vv_scan forward handle 20');
    expect(deletion).toContain('delete rule inet vv_scan forward handle 21');
    expect(deletion).toContain('delete chain inet vv_scan in_0123456789ab');
    expect(deletion).toContain('delete chain inet vv_scan fw_0123456789ab');
  });

  it('rejects a malformed network identifier', async () => {
    const broker = new NftHostFirewallBroker(new FakeNft(), async () => true);
    await expect(broker.install({ id: 'not-a-docker-id', name: NETWORK.name }, ['93.184.216.34']))
      .rejects.toThrow(/network ID/);
  });
});
