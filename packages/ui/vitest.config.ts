import { defineConfig, mergeConfig } from 'vitest/config';
import { domConfig } from '../../vitest.shared.js';

export default mergeConfig(domConfig, defineConfig({}));
