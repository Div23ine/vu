import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared.js';

export default mergeConfig(nodeConfig, defineConfig({}));
