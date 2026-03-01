import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OpenAPIGenerator } from '../../src/generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GitHub spec integration', () => {
  it('should generate and type-check selected GitHub API client operations', async () => {
    const testOutputDir = path.join(__dirname, 'test-output-github-integration');
    const githubSpecUrl =
      'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json';

    try {
      await fs.mkdir(testOutputDir, { recursive: true });

      const response = await fetch(githubSpecUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch GitHub spec: ${response.status}`);
      }

      const specContent = await response.text();
      const specPath = path.join(testOutputDir, 'github-api.json');
      await fs.writeFile(specPath, specContent, 'utf-8');

      const generator = new OpenAPIGenerator({
        spec: specPath,
        outputDir: testOutputDir,
        namespace: 'GitHubAPI',
        operationIds: ['repos/get', 'repos/list-for-user'],
      });

      await generator.generate();

      const tsconfigPath = path.join(testOutputDir, 'tsconfig.test.json');
      await fs.writeFile(
        tsconfigPath,
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2020',
              module: 'ESNext',
              moduleResolution: 'Node',
              strict: true,
              skipLibCheck: true,
              noEmit: true,
              types: ['node'],
            },
            include: ['**/*.ts'],
          },
          null,
          2
        ),
        'utf-8'
      );

      const tsc = spawnSync('bunx', ['tsc', '--noEmit', '-p', tsconfigPath], {
        cwd: testOutputDir,
        encoding: 'utf-8',
      });

      expect(tsc.status, `TypeScript check failed:\n${tsc.stdout}\n${tsc.stderr}`).toBe(0);
    } finally {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    }
  }, 120000);
});
