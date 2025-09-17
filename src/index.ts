export { OpenAPIGenerator } from './generator';
export type { GeneratorOptions } from './generator';

import { OpenAPIGenerator } from './generator';
import type { GeneratorOptions } from './generator';

export async function generateFromSpec(options: GeneratorOptions): Promise<void> {
  const generator = new OpenAPIGenerator(options);
  await generator.generate();
}