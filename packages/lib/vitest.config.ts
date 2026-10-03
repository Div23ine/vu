import { defineProject, mergeConfig } from 'vitest/config';
import { domConfig } from '@vunvault/config/vitest.shared';

export default mergeConfig(domConfig, defineProject({}));
