export { OpenAPIGenerator } from './generator.js';
export { TypeOutputMode, ClientOutputMode, resolveEnvironmentVariables, resolveHeadersEnvironmentVariables } from './types.js';
export type { GeneratorOptions, OTTConfig, APIConfig } from './types.js';

import { OpenAPIGenerator } from './generator.js';
import type { GeneratorOptions } from './types.js';

export async function generateFromSpec(options: GeneratorOptions): Promise<void> {
  const generator = new OpenAPIGenerator(options);
  await generator.generate();
}