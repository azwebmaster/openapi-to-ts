import { describe, it, expect, vi } from 'vitest';
import { generateFromSpec, OpenAPIGenerator } from './index';
import type { GeneratorOptions } from './index';

// Mock the OpenAPIGenerator class
vi.mock('./generator', () => ({
  OpenAPIGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('index.ts', () => {
  describe('generateFromSpec', () => {
    it('should create an OpenAPIGenerator instance and call generate', async () => {
      const options: GeneratorOptions = {
        inputSpec: 'test-spec.yaml',
        outputDir: './output'
      };

      const mockGenerate = vi.fn().mockResolvedValue(undefined);
      const MockedOpenAPIGenerator = OpenAPIGenerator as any;
      MockedOpenAPIGenerator.mockImplementation(() => ({
        generate: mockGenerate
      }));

      await generateFromSpec(options);

      expect(MockedOpenAPIGenerator).toHaveBeenCalledWith(options);
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it('should pass all options to OpenAPIGenerator constructor', async () => {
      const options: GeneratorOptions = {
        inputSpec: 'https://api.example.com/spec.json',
        outputDir: './custom-output',
        namespace: 'CustomAPI',
        axiosInstanceName: 'customClient',
        headers: { 'Authorization': 'Bearer token' }
      };

      const MockedOpenAPIGenerator = OpenAPIGenerator as any;
      MockedOpenAPIGenerator.mockClear();

      await generateFromSpec(options);

      expect(MockedOpenAPIGenerator).toHaveBeenCalledWith(options);
    });

    it('should handle errors from generator', async () => {
      const options: GeneratorOptions = {
        inputSpec: 'invalid-spec.yaml',
        outputDir: './output'
      };

      const mockGenerate = vi.fn().mockRejectedValue(new Error('Generation failed'));
      const MockedOpenAPIGenerator = OpenAPIGenerator as any;
      MockedOpenAPIGenerator.mockImplementation(() => ({
        generate: mockGenerate
      }));

      await expect(generateFromSpec(options)).rejects.toThrow('Generation failed');
    });
  });
});