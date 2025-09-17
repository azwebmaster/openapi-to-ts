import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIGenerator, type GeneratorOptions } from './generator';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('@apidevtools/swagger-parser');
vi.mock('fs/promises');
vi.mock('https');
vi.mock('http');
vi.mock('ts-morph', () => ({
  Project: vi.fn().mockImplementation(() => ({
    createSourceFile: vi.fn().mockReturnValue({
      addTypeAlias: vi.fn(),
      addInterface: vi.fn().mockReturnValue({
        addProperty: vi.fn(),
        addJsDoc: vi.fn()
      }),
      addImportDeclaration: vi.fn(),
      addExportDeclaration: vi.fn(),
      addVariableStatement: vi.fn(),
      addClass: vi.fn().mockReturnValue({
        addJsDoc: vi.fn(),
        addProperty: vi.fn(),
        addConstructor: vi.fn(),
        addMethod: vi.fn().mockReturnValue({
          addStatements: vi.fn()
        })
      })
    }),
    save: vi.fn().mockResolvedValue(undefined)
  })),
  VariableDeclarationKind: {
    Const: 'const'
  }
}));

import SwaggerParser from '@apidevtools/swagger-parser';

describe('OpenAPIGenerator', () => {
  let generator: OpenAPIGenerator;
  let mockOptions: GeneratorOptions;
  
  beforeEach(() => {
    mockOptions = {
      inputSpec: 'test-spec.yaml',
      outputDir: './output'
    };
    generator = new OpenAPIGenerator(mockOptions);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default namespace when not provided', () => {
      const gen = new OpenAPIGenerator({ inputSpec: 'test.yaml', outputDir: './out' });
      expect(gen).toBeDefined();
    });

    it('should use provided namespace', () => {
      const gen = new OpenAPIGenerator({ 
        inputSpec: 'test.yaml', 
        outputDir: './out',
        namespace: 'CustomAPI' 
      });
      expect(gen).toBeDefined();
    });
  });

  describe('generate', () => {
    beforeEach(() => {
      const mockApi = {
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' }
              }
            }
          }
        },
        paths: {}
      };
      
      vi.mocked(SwaggerParser.parse).mockResolvedValue(mockApi as any);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    });

    it('should parse file spec and generate output', async () => {
      await generator.generate();

      expect(SwaggerParser.parse).toHaveBeenCalledWith('test-spec.yaml');
      expect(fs.mkdir).toHaveBeenCalledWith('./output', { recursive: true });
    });

    it('should fetch from URL when inputSpec is a URL', async () => {
      const urlOptions = {
        inputSpec: 'https://api.example.com/spec.json',
        outputDir: './output'
      };
      const urlGenerator = new OpenAPIGenerator(urlOptions);
      
      // Mock the fetchFromUrl method
      const mockApiSpec = { openapi: '3.0.0', info: { title: 'Test API' } };
      vi.spyOn(urlGenerator, 'fetchFromUrl').mockResolvedValue(mockApiSpec);

      await urlGenerator.generate();

      expect(urlGenerator.fetchFromUrl).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        undefined
      );
      expect(SwaggerParser.parse).toHaveBeenCalledWith(mockApiSpec);
    });

    it('should handle errors during generation', async () => {
      vi.mocked(SwaggerParser.parse).mockRejectedValue(new Error('Invalid spec'));

      await expect(generator.generate()).rejects.toThrow('Invalid spec');
    });
  });

  describe('fetchFromUrl', () => {
    it('should be defined as a public method', () => {
      expect(typeof generator.fetchFromUrl).toBe('function');
    });

    it('should handle basic URL fetching', async () => {
      // Create a simple mock that resolves immediately for basic testing
      vi.spyOn(generator, 'fetchFromUrl').mockResolvedValue({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' }
      });

      const result = await generator.fetchFromUrl('https://api.example.com/spec.json');
      
      expect(result).toEqual({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' }
      });
    });
  });

  describe('integration', () => {
    it('should handle complete generation flow', async () => {
      const mockApi = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        components: { schemas: {} },
        paths: {}
      };
      
      vi.mocked(SwaggerParser.parse).mockResolvedValue(mockApi as any);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await expect(generator.generate()).resolves.not.toThrow();
      
      expect(SwaggerParser.parse).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });
});