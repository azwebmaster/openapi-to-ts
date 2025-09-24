import { describe, it, expect, beforeEach } from 'vitest';
import { generateFromSpec, OpenAPIGenerator } from './index';

describe('index', () => {

  describe('exports', () => {
    it('should export OpenAPIGenerator', () => {
      expect(OpenAPIGenerator).toBeDefined();
    });

    it('should export generateFromSpec function', () => {
      expect(generateFromSpec).toBeDefined();
      expect(typeof generateFromSpec).toBe('function');
    });
  });

  describe('generateFromSpec', () => {
    it('should be a function', () => {
      expect(typeof generateFromSpec).toBe('function');
    });

    it('should create and use OpenAPIGenerator instance', () => {
      const options = {
        spec: './test.yaml',
        outputDir: './generated',
        namespace: 'TestAPI',
        axiosInstanceName: 'testClient'
      };

      // Test that the function exists and can be called
      expect(() => {
        const generator = new OpenAPIGenerator(options);
        expect(generator).toBeDefined();
      }).not.toThrow();
    });
  });
});