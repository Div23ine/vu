import { defineProject, mergeConfig } from 'vitest/config';
import { nodeConfig } from '@vunvault/config/vitest.shared';

export default mergeConfig(nodeConfig, defineProject({}));
