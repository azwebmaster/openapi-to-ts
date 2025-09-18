import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAPIGenerator } from './generator';

describe('OpenAPIGenerator', () => {
  let generator: OpenAPIGenerator;
  const mockOptions = {
    inputSpec: './test.yaml',
    outputDir: './generated',
    namespace: 'TestAPI',
    axiosInstanceName: 'testClient'
  };


  describe('constructor', () => {
    it('should initialize with provided options', () => {
      generator = new OpenAPIGenerator(mockOptions);
      expect(generator).toBeDefined();
    });

    it('should use default namespace if not provided', () => {
      const options = { ...mockOptions, namespace: undefined };
      generator = new OpenAPIGenerator(options);
      expect(generator).toBeDefined();
    });
  });

  describe('type generation methods', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator(mockOptions);
    });

    describe('getTypeString', () => {
      it('should handle $ref', () => {
        const result = generator.getTypeString({ $ref: '#/components/schemas/User' });
        expect(result).toBe('User');
      });

      it('should handle anyOf', () => {
        const result = generator.getTypeString({
          anyOf: [
            { type: 'string' },
            { type: 'number' }
          ]
        });
        expect(result).toBe('(string | number)');
      });

      it('should handle oneOf', () => {
        const result = generator.getTypeString({
          oneOf: [
            { type: 'string' },
            { type: 'boolean' }
          ]
        });
        expect(result).toBe('(string | boolean)');
      });

      it('should handle allOf', () => {
        const result = generator.getTypeString({
          allOf: [
            { $ref: '#/components/schemas/Base' },
            { $ref: '#/components/schemas/Extended' }
          ]
        });
        expect(result).toBe('(Base & Extended)');
      });

      it('should handle nullable types (OpenAPI 3.1)', () => {
        const result = generator.getTypeString({
          type: ['string', 'null']
        });
        expect(result).toBe('string | null');
      });

      it('should handle const values', () => {
        const result = generator.getTypeString({
          const: 'fixed-value'
        });
        expect(result).toBe('"fixed-value"');
      });

      it('should handle nullable flag (OpenAPI 3.0)', () => {
        const result = generator.getTypeString({
          type: 'string',
          nullable: true
        });
        expect(result).toBe('(string | null)');
      });

      it('should handle arrays', () => {
        const result = generator.getTypeString({
          type: 'array',
          items: { type: 'string' }
        });
        expect(result).toBe('Array<string>');
      });

      it('should handle objects with properties', () => {
        const result = generator.getTypeString({
          type: 'object',
          properties: {
            id: { type: 'string' },
            age: { type: 'number' }
          },
          required: ['id']
        });
        expect(result).toBe('{ id: string; age?: number }');
      });

      it('should handle objects with additionalProperties', () => {
        const result = generator.getTypeString({
          type: 'object',
          additionalProperties: { type: 'string' }
        });
        expect(result).toBe('Record<string, string>');
      });

      it('should handle enum values', () => {
        const result = generator.getTypeString({
          type: 'string',
          enum: ['red', 'green', 'blue']
        });
        expect(result).toBe('"red" | "green" | "blue"');
      });

      it('should handle empty schema', () => {
        const result = generator.getTypeString(null);
        expect(result).toBe('unknown');
      });
    });

    describe('toTypeName', () => {
      it('should convert kebab-case to PascalCase', () => {
        const result = generator.toTypeName('user-profile');
        expect(result).toBe('UserProfile');
      });

      it('should convert snake_case to PascalCase', () => {
        const result = generator.toTypeName('user_profile');
        expect(result).toBe('UserProfile');
      });

      it('should capitalize first letter', () => {
        const result = generator.toTypeName('user');
        expect(result).toBe('User');
      });
    });

    describe('toPropertyName', () => {
      it('should keep valid identifiers as-is', () => {
        const result = generator.toPropertyName('validName');
        expect(result).toBe('validName');
      });

      it('should quote invalid identifiers', () => {
        const result = generator.toPropertyName('invalid-name');
        expect(result).toBe("'invalid-name'");
      });

      it('should quote names with spaces', () => {
        const result = generator.toPropertyName('name with spaces');
        expect(result).toBe("'name with spaces'");
      });
    });

    describe('toMethodName', () => {
      it('should convert operationId to camelCase', () => {
        const result = generator.toMethodName('GetUserById');
        expect(result).toBe('getUserById');
      });

      it('should handle special characters', () => {
        const result = generator.toMethodName('get-user-by-id');
        expect(result).toBe('getUserById');
      });

      it('should handle path-based names', () => {
        const result = generator.toMethodName('get_/users/{id}');
        expect(result).toBe('getUsersId');
      });

      it('should handle namespaced operationId by taking part after first slash', () => {
        const result = generator.toMethodName('admin/getUser');
        expect(result).toBe('getUser');
      });

      it('should handle multiple slashes in operationId', () => {
        const result = generator.toMethodName('admin/users/getById');
        expect(result).toBe('usersGetById');
      });

      it('should handle operationId without namespace', () => {
        const result = generator.toMethodName('getUser');
        expect(result).toBe('getUser');
      });
    });

    describe('generateJSDocComment', () => {
      it('should generate comment with description', () => {
        const schema = {
          description: 'User information'
        };
        const result = generator.generateJSDocComment(schema);
        expect(result).toBe('User information');
      });

      it('should include constraints', () => {
        const schema = {
          type: 'string',
          format: 'email',
          minLength: 5,
          maxLength: 100
        };
        const result = generator.generateJSDocComment(schema, 'email');
        expect(result).toContain('email property');
        expect(result).toContain('Format: email');
        expect(result).toContain('Min length: 5');
        expect(result).toContain('Max length: 100');
      });

      it('should include enum values', () => {
        const schema = {
          type: 'string',
          enum: ['admin', 'user', 'guest']
        };
        const result = generator.generateJSDocComment(schema, 'role');
        expect(result).toContain('Allowed values: "admin", "user", "guest"');
      });

      it('should include default and example', () => {
        const schema = {
          type: 'string',
          default: 'defaultValue',
          example: 'exampleValue'
        };
        const result = generator.generateJSDocComment(schema, 'field');
        expect(result).toContain('Default: "defaultValue"');
        expect(result).toContain('Example: "exampleValue"');
      });

      it('should return undefined for empty schema', () => {
        const result = generator.generateJSDocComment({});
        expect(result).toBeUndefined();
      });
    });

    describe('getResponseType', () => {
      it('should handle successful response with content', () => {
        const responses = {
          '200': {
            content: {
              'application/json': {
                schema: { type: 'string' }
              }
            }
          }
        };
        const result = generator.getResponseType(responses);
        expect(result).toBe('string');
      });

      it('should handle no successful response', () => {
        const responses = {
          '404': { description: 'Not found' }
        };
        const result = generator.getResponseType(responses);
        expect(result).toBe('unknown');
      });

      it('should handle response without content', () => {
        const responses = {
          '204': { description: 'No content' }
        };
        const result = generator.getResponseType(responses);
        expect(result).toBe('void');
      });
    });
  });

  describe('complex schema handling', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator(mockOptions);
    });

    describe('generateDiscriminatedUnion', () => {
      it('should handle discriminated union with mapping', () => {
        const schema = {
          discriminator: {
            propertyName: 'type',
            mapping: {
              cat: '#/components/schemas/Cat',
              dog: '#/components/schemas/Dog'
            }
          }
        };
        const types = ['Cat', 'Dog'];
        const result = generator.generateDiscriminatedUnion(schema, types);
        expect(result).toBe('(Cat & { type: "cat" }) | (Dog & { type: "dog" })');
      });

      it('should handle discriminated union without mapping', () => {
        const schema = {
          discriminator: {
            propertyName: 'type'
          }
        };
        const types = ['Cat', 'Dog'];
        const result = generator.generateDiscriminatedUnion(schema, types);
        expect(result).toBe('Cat | Dog');
      });

      it('should handle discriminator without propertyName', () => {
        const schema = {
          discriminator: {}
        };
        const types = ['Cat', 'Dog'];
        const result = generator.generateDiscriminatedUnion(schema, types);
        expect(result).toBe('Cat | Dog');
      });
    });

    describe('handleConst', () => {
      it('should handle string const', () => {
        const result = generator.handleConst({ const: 'fixed' });
        expect(result).toBe('"fixed"');
      });

      it('should handle number const', () => {
        const result = generator.handleConst({ const: 42 });
        expect(result).toBe('42');
      });

      it('should handle boolean const', () => {
        const result = generator.handleConst({ const: true });
        expect(result).toBe('true');
      });

      it('should handle undefined const', () => {
        const result = generator.handleConst({});
        expect(result).toBe('unknown');
      });
    });

    describe('getPrimitiveType', () => {
      it('should handle string type', () => {
        const result = generator.getPrimitiveType('string', {});
        expect(result).toBe('string');
      });

      it('should handle string enum', () => {
        const result = generator.getPrimitiveType('string', { enum: ['a', 'b'] });
        expect(result).toBe('"a" | "b"');
      });

      it('should handle number type', () => {
        const result = generator.getPrimitiveType('number', {});
        expect(result).toBe('number');
      });

      it('should handle integer type', () => {
        const result = generator.getPrimitiveType('integer', {});
        expect(result).toBe('number');
      });

      it('should handle boolean type', () => {
        const result = generator.getPrimitiveType('boolean', {});
        expect(result).toBe('boolean');
      });

      it('should handle array type', () => {
        const result = generator.getPrimitiveType('array', { items: { type: 'string' } });
        expect(result).toBe('Array<string>');
      });

      it('should handle object type', () => {
        const result = generator.getPrimitiveType('object', {});
        expect(result).toBe('Record<string, unknown>');
      });

      it('should handle unknown type', () => {
        const result = generator.getPrimitiveType('unknown', {});
        expect(result).toBe('unknown');
      });
    });

    describe('getBaseTypeString', () => {
      it('should handle number enum', () => {
        const result = generator.getBaseTypeString({ type: 'number', enum: [1, 2, 3] });
        expect(result).toBe('1 | 2 | 3');
      });

      it('should handle object with additional properties true', () => {
        const result = generator.getBaseTypeString({
          type: 'object',
          additionalProperties: true
        });
        expect(result).toBe('Record<string, unknown>');
      });

      it('should handle unknown type', () => {
        const result = generator.getBaseTypeString({ type: 'unknown' });
        expect(result).toBe('unknown');
      });
    });
  });
});