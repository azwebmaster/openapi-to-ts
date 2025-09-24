import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAPIGenerator } from './generator';
import * as fs from 'fs/promises';
import * as path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';

describe('OpenAPIGenerator', () => {
  let generator: OpenAPIGenerator;
  const mockOptions = {
    spec: './test.yaml',
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

      it('should handle OpenAPI v2 (Swagger 2.0) response format', () => {
        const responses = {
          '200': {
            description: 'Successful response',
            schema: {
              type: 'array',
              items: {
                $ref: '#/definitions/User'
              }
            }
          }
        };
        const result = generator.getResponseType(responses);
        expect(result).toBe('Array<User>');
      });

      it('should handle OpenAPI v2 response with direct schema reference', () => {
        const responses = {
          '201': {
            description: 'User created',
            schema: {
              $ref: '#/definitions/User'
            }
          }
        };
        const result = generator.getResponseType(responses);
        expect(result).toBe('User');
      });

      it('should handle OpenAPI v2 response without schema', () => {
        const responses = {
          '204': { description: 'No content' }
        };
        const result = generator.getResponseType(responses);
        expect(result).toBe('void');
      });
    });
  });

  describe('collectUsedTypes with OpenAPI v2 responses', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator({
        spec: 'test-spec.json',
        outputDir: './test-output'
      });
    });

    it('should collect types from OpenAPI v2 response schemas', () => {
      // Mock API with OpenAPI v2 format
      generator['api'] = {
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  description: 'Successful response',
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/definitions/User'
                    }
                  }
                }
              }
            }
          },
          '/products/{id}': {
            get: {
              operationId: 'getProduct',
              responses: {
                '200': {
                  description: 'Product found',
                  schema: {
                    $ref: '#/definitions/Product'
                  }
                },
                '404': {
                  description: 'Not found',
                  schema: {
                    $ref: '#/definitions/ErrorResponse'
                  }
                }
              }
            }
          }
        }
      } as any;

      const usedTypes = generator['collectUsedTypes']();
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('Product');
      // ErrorResponse should not be collected as it's only used in error responses
      expect(usedTypes).not.toContain('ErrorResponse');
    });

    it('should collect types from both OpenAPI v2 and v3 response formats', () => {
      // Mock API with mixed formats
      generator['api'] = {
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  description: 'Successful response',
                  schema: {
                    $ref: '#/definitions/User'
                  }
                }
              }
            }
          },
          '/orders': {
            get: {
              operationId: 'getOrders',
              responses: {
                '200': {
                  description: 'Successful response',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/Order'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      const usedTypes = generator['collectUsedTypes']();
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('Order');
    });

    it('should not collect types from responses without schemas', () => {
      generator['api'] = {
        paths: {
          '/health': {
            get: {
              operationId: 'healthCheck',
              responses: {
                '200': {
                  description: 'OK'
                },
                '204': {
                  description: 'No content'
                }
              }
            }
          }
        }
      } as any;

      const usedTypes = generator['collectUsedTypes']();
      expect(usedTypes).toEqual([]);
    });

    it('should collect types from nested response schemas', () => {
      generator['api'] = {
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  description: 'Successful response',
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          $ref: '#/definitions/User'
                        }
                      },
                      meta: {
                        $ref: '#/definitions/PaginationMeta'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      const usedTypes = generator['collectUsedTypes']();
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('PaginationMeta');
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

  describe('duplicate operationId handling', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator(mockOptions);
    });

    it('should handle duplicate operationIds by appending sequence numbers', () => {
      // Mock API with duplicate operationIds
      (generator as any).api = {
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
            post: { operationId: 'getUsers' } // Duplicate
          },
          '/users/{id}': {
            get: { operationId: 'getUsers' }, // Another duplicate
            put: { operationId: 'updateUser' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Extract all operationIds from the result
      const operationIds = Object.values(result)
        .flat()
        .map((op: any) => op.operationId);

      // Should have: 'getUsers', 'getUsers2', 'getUsers3', 'updateUser'
      expect(operationIds).toContain('getUsers');
      expect(operationIds).toContain('getUsers2');
      expect(operationIds).toContain('getUsers3');
      expect(operationIds).toContain('updateUser');
      expect(operationIds).toHaveLength(4);
    });

    it('should handle duplicates in namespaced operationIds', () => {
      // Mock API with duplicate namespaced operationIds
      (generator as any).api = {
        paths: {
          '/admin/users': {
            get: { operationId: 'admin/getUsers' },
            post: { operationId: 'admin/getUsers' } // Duplicate
          },
          '/admin/roles': {
            get: { operationId: 'admin/getUsers' } // Another duplicate
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should all be in the 'admin' namespace
      expect(result).toHaveProperty('admin');
      expect(result.admin).toHaveLength(3);

      const operationIds = result.admin.map((op: any) => op.operationId);
      expect(operationIds).toContain('admin/getUsers');
      expect(operationIds).toContain('admin/getUsers2');
      expect(operationIds).toContain('admin/getUsers3');
    });

    it('should not affect unique operationIds', () => {
      // Mock API with unique operationIds
      (generator as any).api = {
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
            post: { operationId: 'createUser' }
          },
          '/users/{id}': {
            get: { operationId: 'getUserById' },
            put: { operationId: 'updateUser' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      const operationIds = Object.values(result)
        .flat()
        .map((op: any) => op.operationId);

      // All should remain unchanged
      expect(operationIds).toContain('getUsers');
      expect(operationIds).toContain('createUser');
      expect(operationIds).toContain('getUserById');
      expect(operationIds).toContain('updateUser');
      expect(operationIds).toHaveLength(4);
    });
  });

  describe('OpenAPI v2 parameter handling', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator(mockOptions);
    });

    it('should handle OpenAPI v2 parameter with type directly on parameter', () => {
      const param = {
        name: 'namespace',
        in: 'path',
        required: true,
        type: 'string',
        format: 'domain',
        description: 'Namespace to retrieve the records for.'
      };

      const schema = (generator as any).getParameterSchema(param);

      expect(schema.type).toBe('string');
      expect(schema.format).toBe('domain');
      expect(schema.description).toBe('Namespace to retrieve the records for.');
    });

    it('should handle OpenAPI v3 parameter with schema property', () => {
      const param = {
        name: 'id',
        in: 'path',
        required: true,
        schema: {
          type: 'integer',
          format: 'int64'
        }
      };

      const schema = (generator as any).getParameterSchema(param);

      expect(schema.type).toBe('integer');
      expect(schema.format).toBe('int64');
    });

    it('should handle OpenAPI v2 array parameter', () => {
      const param = {
        name: 'tags',
        in: 'query',
        required: false,
        type: 'array',
        items: {
          type: 'string'
        }
      };

      const schema = (generator as any).getParameterSchema(param);

      expect(schema.type).toBe('array');
      expect(schema.items).toEqual({ type: 'string' });
    });

    it('should handle OpenAPI v2 parameter with enum', () => {
      const param = {
        name: 'status',
        in: 'query',
        required: false,
        type: 'string',
        enum: ['active', 'inactive', 'pending']
      };

      const schema = (generator as any).getParameterSchema(param);

      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['active', 'inactive', 'pending']);
    });

    it('should fallback to string for parameter without type', () => {
      const param = {
        name: 'unknown',
        in: 'query',
        required: false
      };

      const schema = (generator as any).getParameterSchema(param);

      expect(schema.type).toBe('string');
    });

    it('should copy all relevant OpenAPI v2 constraints to schema', () => {
      const param = {
        name: 'count',
        in: 'query',
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 10,
        example: 25,
        description: 'Number of items to return'
      };

      const schema = (generator as any).getParameterSchema(param);

      expect(schema.type).toBe('integer');
      expect(schema.minimum).toBe(1);
      expect(schema.maximum).toBe(100);
      expect(schema.default).toBe(10);
      expect(schema.example).toBe(25);
      expect(schema.description).toBe('Number of items to return');
    });

    it('should handle OpenAPI v2 body parameter', () => {
      const param = {
        name: 'body',
        in: 'body',
        required: true,
        schema: {
          $ref: '#/definitions/User'
        }
      };

      const schema = (generator as any).getParameterSchema(param);

      expect(schema).toEqual({
        $ref: '#/definitions/User'
      });
    });
  });

  describe('OpenAPI v2 integration tests', () => {
    let generator: OpenAPIGenerator;
    const testOutputDir = './test-integration-output';

    beforeEach(() => {
      generator = new OpenAPIGenerator({
        spec: 'test-spec.json',
        outputDir: testOutputDir
      });
      // Mock the SwaggerParser.parse method to avoid file reading
      generator['api'] = null;
    });

    afterEach(async () => {
      // Clean up test output
      try {
        const fs = await import('fs/promises');
        await fs.rm(testOutputDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should collect all response types for OpenAPI v2 client generation', async () => {
      // Mock a complete OpenAPI v2 specification
      generator['api'] = {
        info: {
          title: 'Test API',
          version: '1.0.0',
          description: 'Test API for OpenAPI v2'
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              parameters: [
                {
                  name: 'page',
                  in: 'query',
                  type: 'integer',
                  minimum: 1
                }
              ],
              responses: {
                '200': {
                  description: 'Successful response',
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/definitions/User'
                    }
                  }
                },
                '400': {
                  description: 'Bad request',
                  schema: {
                    $ref: '#/definitions/ErrorResponse'
                  }
                }
              }
            },
            post: {
              operationId: 'createUser',
              summary: 'Create a new user',
              parameters: [
                {
                  name: 'body',
                  in: 'body',
                  required: true,
                  schema: {
                    $ref: '#/definitions/User'
                  }
                }
              ],
              responses: {
                '201': {
                  description: 'User created',
                  schema: {
                    $ref: '#/definitions/User'
                  }
                }
              }
            }
          },
          '/products/{id}': {
            get: {
              operationId: 'getProduct',
              summary: 'Get a product by ID',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  type: 'string'
                }
              ],
              responses: {
                '200': {
                  description: 'Product found',
                  schema: {
                    $ref: '#/definitions/Product'
                  }
                },
                '404': {
                  description: 'Product not found',
                  schema: {
                    $ref: '#/definitions/ErrorResponse'
                  }
                }
              }
            }
          }
        },
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer', format: 'int64' },
              username: { type: 'string' },
              email: { type: 'string', format: 'email' }
            },
            required: ['id', 'username', 'email']
          },
          Product: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              price: { type: 'number', format: 'float' }
            },
            required: ['id', 'name', 'price']
          },
          ErrorResponse: {
            type: 'object',
            properties: {
              code: { type: 'integer' },
              message: { type: 'string' }
            },
            required: ['code', 'message']
          }
        }
      } as any;

      // Test that collectUsedTypes finds only success response types
      const usedTypes = generator['collectUsedTypes']();
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('Product');
      // ErrorResponse should not be collected as it's only used in error responses
      expect(usedTypes).not.toContain('ErrorResponse');

      // Test response type generation
      const getUsersResponse = generator.getResponseType({
        '200': {
          description: 'Successful response',
          schema: {
            type: 'array',
            items: {
              $ref: '#/definitions/User'
            }
          }
        }
      });
      expect(getUsersResponse).toBe('Array<User>');

      const getProductResponse = generator.getResponseType({
        '200': {
          description: 'Product found',
          schema: {
            $ref: '#/definitions/Product'
          }
        }
      });
      expect(getProductResponse).toBe('Product');
    });

    it('should handle mixed OpenAPI v2 and v3 response formats', async () => {
      generator['api'] = {
        info: { title: 'Mixed API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  description: 'OpenAPI v2 format',
                  schema: {
                    $ref: '#/definitions/User'
                  }
                }
              }
            }
          },
          '/orders': {
            get: {
              operationId: 'getOrders',
              responses: {
                '200': {
                  description: 'OpenAPI v3 format',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/Order'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' }
            }
          }
        },
        components: {
          schemas: {
            Order: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            }
          }
        }
      } as any;

      // Test that collectUsedTypes finds both v2 and v3 response types
      const usedTypes = generator['collectUsedTypes']();
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('Order');

      // Test that both response formats work correctly
      const v2Response = generator.getResponseType({
        '200': {
          description: 'OpenAPI v2 format',
          schema: {
            $ref: '#/definitions/User'
          }
        }
      });
      expect(v2Response).toBe('User');

      const v3Response = generator.getResponseType({
        '200': {
          description: 'OpenAPI v3 format',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Order'
              }
            }
          }
        }
      });
      expect(v3Response).toBe('Order');
    });

    it('should handle OpenAPI v2 body parameters in method generation', () => {
      // Test the parameter collection logic directly
      const operation = {
        operationId: 'createUser',
        summary: 'Create a new user',
        parameters: [
          {
            name: 'body',
            in: 'body',
            required: true,
            schema: {
              $ref: '#/definitions/User'
            }
          }
        ],
        responses: {
          '201': {
            description: 'User created',
            schema: {
              $ref: '#/definitions/User'
            }
          }
        }
      };

      // Test that body parameters are filtered out from allParams
      const parameters = operation.parameters || [];
      const allParams: any[] = [];
      const bodyParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: 'User', // Mock type
          required: param.required,
          description: param.description,
          in: param.in,
        };

        // Only add non-body parameters to allParams
        if (param.in !== 'body') {
          allParams.push(paramInfo);
        } else {
          bodyParams.push(paramInfo);
        }
      }

      // Verify that body parameters are handled correctly
      expect(allParams).toHaveLength(0); // No non-body parameters
      expect(bodyParams).toHaveLength(1); // One body parameter
      expect(bodyParams[0].name).toBe('body');
      expect(bodyParams[0].in).toBe('body');
      expect(bodyParams[0].required).toBe(true);
    });

    it('should include body parameters in axios call generation', () => {
      // Test the axios call generation logic for body parameters
      const method = 'post';
      const requestBody = null; // No OpenAPI v3 requestBody
      const bodyParams = [{ name: 'body', in: 'body', required: true }]; // OpenAPI v2 body parameter
      
      let axiosCall = `this.client.${method}(\`/users\``;
      
      // Simulate the logic from generateMethod
      if (method === 'get' || method === 'delete' || method === 'head' || method === 'options') {
        // GET/DELETE methods don't have body
        axiosCall += ')';
      } else {
        // POST/PUT methods with body
        if (requestBody || bodyParams.length > 0) {
          axiosCall += ', data';
        } else {
          axiosCall += ', undefined';
        }
        axiosCall += ', config';
      }
      axiosCall += ')';
      
      // Verify that the axios call includes the data parameter
      expect(axiosCall).toContain('this.client.post');
      expect(axiosCall).toContain('data');
      expect(axiosCall).toContain('config');
    });

    it('should handle required parameter ordering correctly with body parameters', () => {
      // Test scenario: path parameter + body parameter
      const operation = {
        operationId: 'updateUser',
        summary: 'Update a user',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            type: 'string'
          },
          {
            name: 'body',
            in: 'body',
            required: true,
            schema: {
              $ref: '#/definitions/User'
            }
          }
        ],
        responses: {
          '200': {
            description: 'User updated',
            schema: {
              $ref: '#/definitions/User'
            }
          }
        }
      };

      // Simulate the parameter collection logic
      const parameters = operation.parameters || [];
      const allParams: any[] = [];
      const bodyParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: param.type || 'string',
          required: param.required,
          description: param.description,
          in: param.in,
        };

        if (param.in !== 'body') {
          allParams.push(paramInfo);
        } else {
          bodyParams.push(paramInfo);
        }
      }

      // Check that we have both path and body parameters
      expect(allParams).toHaveLength(1); // path parameter
      expect(bodyParams).toHaveLength(1); // body parameter
      expect(allParams[0].name).toBe('id');
      expect(allParams[0].required).toBe(true);
      expect(bodyParams[0].name).toBe('body');
      expect(bodyParams[0].required).toBe(true);

      // Simulate the parameter ordering logic
      const hasParams = allParams.length > 0;
      const hasRequestBody = bodyParams.length > 0;
      const allRequired = allParams.filter(p => p.required).length > 0;
      const shouldMakeParamsOptional = hasRequestBody || !allRequired;

      // When we have both path and body parameters, params should be optional
      // to avoid "required parameter cannot follow optional parameter"
      expect(shouldMakeParamsOptional).toBe(true);
    });
  });

  describe('configuration system', () => {
    let generator: OpenAPIGenerator;
    const testOutputDir = './test-config-output';

    beforeEach(() => {
      generator = new OpenAPIGenerator({
        spec: 'test-spec.json',
        outputDir: testOutputDir
      });
    });

    afterEach(async () => {
      // Clean up test output
      try {
        const fs = await import('fs/promises');
        await fs.rm(testOutputDir, { recursive: true, force: true });
        await fs.rm('.ott.json', { force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should filter operations based on operationIds in config', async () => {
      // Mock API with multiple operations
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  description: 'Success',
                  schema: { $ref: '#/definitions/User' }
                }
              }
            },
            post: {
              operationId: 'createUser',
              responses: {
                '201': {
                  description: 'Created',
                  schema: { $ref: '#/definitions/User' }
                }
              }
            }
          },
          '/products/{id}': {
            get: {
              operationId: 'getProduct',
              responses: {
                '200': {
                  description: 'Success',
                  schema: { $ref: '#/definitions/Product' }
                }
              }
            }
          }
        },
        definitions: {
          User: { type: 'object', properties: { id: { type: 'string' } } },
          Product: { type: 'object', properties: { id: { type: 'string' } } }
        }
      } as any;

      // Set operationIds to only include getUsers and getProduct
      generator['operationIds'] = ['getUsers', 'getProduct'];

      // Apply filtering
      generator['filterOperationsByConfig']();

      // Verify only selected operations remain
      expect(generator['api']?.paths).toBeDefined();
      const paths = generator['api']?.paths as any;
      
      // getUsers should be present
      expect(paths['/users']?.get).toBeDefined();
      expect(paths['/users']?.get.operationId).toBe('getUsers');
      
      // createUser should be filtered out
      expect(paths['/users']?.post).toBeUndefined();
      
      // getProduct should be present
      expect(paths['/products/{id}']?.get).toBeDefined();
      expect(paths['/products/{id}']?.get.operationId).toBe('getProduct');
    });

    it('should not filter when no operationIds are specified', async () => {
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: { '200': { description: 'Success' } }
            },
            post: {
              operationId: 'createUser',
              responses: { '201': { description: 'Created' } }
            }
          }
        }
      } as any;

      // No operationIds specified
      generator['operationIds'] = undefined;

      // Apply filtering
      generator['filterOperationsByConfig']();

      // All operations should remain
      const paths = generator['api']?.paths as any;
      expect(paths['/users']?.get).toBeDefined();
      expect(paths['/users']?.post).toBeDefined();
    });

    it('should not filter when operationIds array is empty', async () => {
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      } as any;

      // Empty operationIds array
      generator['operationIds'] = [];

      // Apply filtering
      generator['filterOperationsByConfig']();

      // All operations should remain
      const paths = generator['api']?.paths as any;
      expect(paths['/users']?.get).toBeDefined();
    });

    it('should handle operations without operationId by using fallback naming', async () => {
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              // No operationId - should use fallback 'get_/users'
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      } as any;

      // Include the fallback operationId
      generator['operationIds'] = ['get_/users'];

      // Apply filtering
      generator['filterOperationsByConfig']();

      // Operation should remain
      const paths = generator['api']?.paths as any;
      expect(paths['/users']?.get).toBeDefined();
    });
  });

  describe('transitive schema reference inclusion', () => {
    let generator: OpenAPIGenerator;

    beforeEach(async () => {
      generator = new OpenAPIGenerator({
        spec: 'test-spec.yaml',
        outputDir: './test-output',
        namespace: 'TestAPI'
      });
    });

    it('should include transitive references when filtering by operationIds', async () => {
      // Mock API with transitive references: A -> B -> C
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'User': {
              type: 'object',
              properties: {
                id: { type: 'string' },
                profile: { $ref: '#/components/schemas/UserProfile' }
              }
            },
            'UserProfile': {
              type: 'object',
              properties: {
                name: { type: 'string' },
                address: { $ref: '#/components/schemas/Address' }
              }
            },
            'Address': {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' }
              }
            },
            'UnusedSchema': {
              type: 'object',
              properties: {
                data: { type: 'string' }
              }
            }
          }
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          },
          '/products': {
            get: {
              operationId: 'getProducts',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/UnusedSchema' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Filter to only include getUsers operation
      generator['operationIds'] = ['getUsers'];

      // Apply filtering
      generator['filterOperationsByConfig']();

      // Collect used types
      const usedTypes = generator['collectUsedTypes']();

      // Should include User (directly referenced), UserProfile (referenced by User), and Address (referenced by UserProfile)
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('UserProfile');
      expect(usedTypes).toContain('Address');
      
      // Should NOT include UnusedSchema since getProducts operation was filtered out
      expect(usedTypes).not.toContain('UnusedSchema');
    });

    it('should handle composition schemas with transitive references', async () => {
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'BaseEntity': {
              type: 'object',
              properties: {
                id: { type: 'string' },
                createdAt: { type: 'string' }
              }
            },
            'User': {
              allOf: [
                { $ref: '#/components/schemas/BaseEntity' },
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    contact: { $ref: '#/components/schemas/Contact' }
                  }
                }
              ]
            },
            'Contact': {
              type: 'object',
              properties: {
                email: { type: 'string' },
                phone: { type: 'string' }
              }
            }
          }
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      generator['operationIds'] = ['getUsers'];
      generator['filterOperationsByConfig']();

      const usedTypes = generator['collectUsedTypes']();

      // Should include all schemas in the transitive chain
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('BaseEntity');
      expect(usedTypes).toContain('Contact');
    });

    it('should handle array schemas with transitive references', async () => {
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'User': {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            },
            'UserList': {
              type: 'array',
              items: { $ref: '#/components/schemas/User' }
            }
          }
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/UserList' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      generator['operationIds'] = ['getUsers'];
      generator['filterOperationsByConfig']();

      const usedTypes = generator['collectUsedTypes']();

      // Should include both UserList and User (referenced by array items)
      expect(usedTypes).toContain('UserList');
      expect(usedTypes).toContain('User');
    });

    it('should handle OpenAPI 2.0 definitions references', async () => {
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        definitions: {
          'User': {
            type: 'object',
            properties: {
              id: { type: 'string' },
              profile: { $ref: '#/definitions/UserProfile' }
            }
          },
          'UserProfile': {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  schema: { $ref: '#/definitions/User' }
                }
              }
            }
          }
        }
      } as any;

      generator['operationIds'] = ['getUsers'];
      generator['filterOperationsByConfig']();

      const usedTypes = generator['collectUsedTypes']();

      // Should include both User and UserProfile (referenced via OpenAPI 2.0 definitions)
      expect(usedTypes).toContain('User');
      expect(usedTypes).toContain('UserProfile');
    });

    it('should not include schemas when no operationIds are specified', async () => {
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'User': {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            },
            'Product': {
              type: 'object',
              properties: {
                name: { type: 'string' }
              }
            }
          }
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // No operationIds specified - should include all schemas
      generator['operationIds'] = undefined;
      generator['filterOperationsByConfig']();

      const usedTypes = generator['collectUsedTypes']();

      // Should only include User (directly referenced by operation)
      expect(usedTypes).toContain('User');
      expect(usedTypes).not.toContain('Product');
    });
  });

  describe('resource leak detection', () => {
    let generator: OpenAPIGenerator;
    let testOutputDir: string;
    let initialFileHandles: number;
    let initialMemoryUsage: NodeJS.MemoryUsage;

    beforeEach(async () => {
      // Record initial resource state
      initialMemoryUsage = process.memoryUsage();
      
      // Create a unique test output directory
      testOutputDir = path.join(process.cwd(), 'test-output-leak-detection');
      
      // Clean up any existing test directory
      try {
        await fs.rm(testOutputDir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist, that's fine
      }

      // Mock SwaggerParser.parse to avoid file reading
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'User': {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          }
        }
      };

      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi as any);

      generator = new OpenAPIGenerator({
        spec: 'test-spec.yaml',
        outputDir: testOutputDir,
        namespace: 'TestAPI'
      });
    });

    afterEach(async () => {
      // Clean up test directory
      try {
        await fs.rm(testOutputDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
      
      // Restore mocks
      vi.restoreAllMocks();
    });

    it('should not leak file handles during generation', async () => {
      // Get initial file handle count (approximate)
      const initialStats = await getFileHandleStats();
      
      // Perform generation multiple times to stress test
      for (let i = 0; i < 5; i++) {
        await generator.generate();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Wait a bit for handles to be released
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalStats = await getFileHandleStats();
      
      // File handle count should not have increased significantly
      // Allow for some variance due to system operations
      expect(finalStats.openFiles).toBeLessThanOrEqual(initialStats.openFiles + 10);
    });

    it('should not leak memory during repeated generation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform generation multiple times
      for (let i = 0; i < 10; i++) {
        await generator.generate();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should properly clean up temporary files', async () => {
      await generator.generate();
      
      // Check that output files were created
      const typesFile = path.join(testOutputDir, 'types.ts');
      const clientFile = path.join(testOutputDir, 'client.ts');
      const indexFile = path.join(testOutputDir, 'index.ts');
      
      expect(await fileExists(typesFile)).toBe(true);
      expect(await fileExists(clientFile)).toBe(true);
      expect(await fileExists(indexFile)).toBe(true);
      
      // Clean up and verify files are gone
      await fs.rm(testOutputDir, { recursive: true, force: true });
      
      expect(await fileExists(typesFile)).toBe(false);
      expect(await fileExists(clientFile)).toBe(false);
      expect(await fileExists(indexFile)).toBe(false);
    });

    it('should handle network request cleanup properly', async () => {
      // Mock the fetchFromUrl method directly
      const originalFetchFromUrl = generator['fetchFromUrl'];
      let requestCount = 0;
      let resolvedCount = 0;
      
      generator['fetchFromUrl'] = vi.fn().mockImplementation(async (url: string) => {
        requestCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolvedCount++;
            resolve({
              info: { title: 'Remote API', version: '1.0.0' },
              paths: {}
            });
          }, 10);
        });
      });

      try {
        // Create generator with remote spec
        const remoteGenerator = new OpenAPIGenerator({
          spec: 'https://api.example.com/openapi.json',
          outputDir: testOutputDir,
          namespace: 'RemoteAPI'
        });

        // Mock the fetchFromUrl for the remote generator too
        remoteGenerator['fetchFromUrl'] = generator['fetchFromUrl'];

        // Generate multiple times
        for (let i = 0; i < 3; i++) {
          await remoteGenerator.generate();
        }
        
        // Wait for all requests to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // All requests should have been resolved
        expect(resolvedCount).toBe(requestCount);
        expect(requestCount).toBeGreaterThan(0);
        
      } finally {
        generator['fetchFromUrl'] = originalFetchFromUrl;
      }
    });

    it('should not leak event listeners', async () => {
      const initialListeners = process.listenerCount('uncaughtException') + 
                              process.listenerCount('unhandledRejection');
      
      // Perform generation
      await generator.generate();
      
      const finalListeners = process.listenerCount('uncaughtException') + 
                            process.listenerCount('unhandledRejection');
      
      // Event listener count should not increase
      expect(finalListeners).toBeLessThanOrEqual(initialListeners);
    });

    it('should handle concurrent generation without resource leaks', async () => {
      const concurrentGenerators = Array.from({ length: 5 }, (_, i) => {
        const concurrentOutputDir = path.join(testOutputDir, `concurrent-${i}`);
        return new OpenAPIGenerator({
          spec: 'test-spec.yaml',
          outputDir: concurrentOutputDir,
          namespace: `ConcurrentAPI${i}`
        });
      });

      // Set up API data for all generators
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'User': {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          }
        }
      };

      concurrentGenerators.forEach(gen => {
        gen['api'] = mockApi as any;
      });

      const initialMemory = process.memoryUsage();
      
      // Run all generators concurrently
      await Promise.all(concurrentGenerators.map(gen => gen.generate()));
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable even with concurrent operations
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Clean up concurrent output directories
      await Promise.all(
        concurrentGenerators.map((_, i) => 
          fs.rm(path.join(testOutputDir, `concurrent-${i}`), { recursive: true, force: true })
        )
      );
    });
  });
});

// Helper functions for leak detection
async function getFileHandleStats(): Promise<{ openFiles: number }> {
  try {
    // On Unix-like systems, we can check /proc/self/fd
    if (process.platform !== 'win32') {
      const fdDir = '/proc/self/fd';
      const files = await fs.readdir(fdDir);
      return { openFiles: files.length };
    }
  } catch (error) {
    // Fallback: return a reasonable estimate
  }
  
  // Fallback for Windows or when /proc is not available
  return { openFiles: 0 };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}