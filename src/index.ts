export { OpenAPIGenerator, TypeOutputMode } from './generator.js';
export type { GeneratorOptions, OTTConfig, APIConfig } from './generator.js';

import { OpenAPIGenerator } from './generator.js';
import type { GeneratorOptions } from './generator.js';

export async function generateFromSpec(options: GeneratorOptions): Promise<void> {
  const generator = new OpenAPIGenerator(options);
  await generator.generate();
}