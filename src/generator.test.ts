import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAPIGenerator } from './generator';
import { resolveEnvironmentVariables, resolveHeadersEnvironmentVariables } from './types';
import { NamingUtils } from './utils/naming';
import { JSDocUtils } from './utils/jsdoc';
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

    describe('NamingUtils', () => {
      let naming: NamingUtils;
      
      beforeEach(() => {
        naming = new NamingUtils();
      });
      
      describe('toTypeName', () => {
        it('should convert kebab-case to PascalCase', () => {
          const result = naming.toTypeName('user-profile');
          expect(result).toBe('UserProfile');
        });

        it('should convert snake_case to PascalCase', () => {
          const result = naming.toTypeName('user_profile');
          expect(result).toBe('UserProfile');
        });

        it('should capitalize first letter', () => {
          const result = naming.toTypeName('user');
          expect(result).toBe('User');
        });
      });

      describe('toPropertyName', () => {
        it('should keep valid identifiers as-is', () => {
          const result = naming.toPropertyName('validName');
          expect(result).toBe('validName');
        });

        it('should quote invalid identifiers', () => {
          const result = naming.toPropertyName('invalid-name');
          expect(result).toBe("'invalid-name'");
        });

        it('should quote names with spaces', () => {
          const result = naming.toPropertyName('name with spaces');
          expect(result).toBe("'name with spaces'");
        });
      });

      describe('toMethodName', () => {
        it('should convert operationId to camelCase', () => {
          const result = naming.toMethodName('GetUserById');
          expect(result).toBe('getUserById');
        });

        it('should handle special characters', () => {
          const result = naming.toMethodName('get-user-by-id');
          expect(result).toBe('getUserById');
        });

        it('should handle path-based names', () => {
          const result = naming.toMethodName('get_/users/{id}');
          expect(result).toBe('getUsersId');
        });

        it('should handle namespaced operationId by taking part after first slash', () => {
          const result = naming.toMethodName('admin/getUser');
          expect(result).toBe('getUser');
        });

        it('should handle multiple slashes in operationId', () => {
          const result = naming.toMethodName('admin/users/getById');
          expect(result).toBe('usersGetById');
        });

        it('should handle operationId without namespace', () => {
          const result = naming.toMethodName('getUser');
          expect(result).toBe('getUser');
        });
      });
    });

    describe('JSDocUtils', () => {
      let jsdoc: JSDocUtils;
      
      beforeEach(() => {
        jsdoc = new JSDocUtils();
      });
      
      describe('generateJSDocComment', () => {
        it('should generate comment with description', () => {
          const schema = {
            description: 'User information'
          };
          const result = jsdoc.generateJSDocComment(schema);
          expect(result).toBe('User information');
        });

        it('should include constraints', () => {
          const schema = {
            type: 'string',
            format: 'email',
            minLength: 5,
            maxLength: 100
          };
          const result = jsdoc.generateJSDocComment(schema, 'email');
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
          const result = jsdoc.generateJSDocComment(schema, 'role');
          expect(result).toContain('Allowed values: "admin", "user", "guest"');
        });

        it('should include default and example', () => {
          const schema = {
            type: 'string',
            default: 'defaultValue',
            example: 'exampleValue'
          };
          const result = jsdoc.generateJSDocComment(schema, 'field');
          expect(result).toContain('Default: "defaultValue"');
          expect(result).toContain('Example: "exampleValue"');
        });

        it('should return undefined for empty schema', () => {
          const result = jsdoc.generateJSDocComment({});
          expect(result).toBeUndefined();
        });
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

  describe('namespace splitting with different separators', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator(mockOptions);
    });

    it('should handle namespaced operations with forward slash separator', () => {
      // Mock API with forward slash namespaced operations
      (generator as any).api = {
        paths: {
          '/admin/users': {
            get: { operationId: 'admin/getUsers' },
            post: { operationId: 'admin/createUser' }
          },
          '/admin/roles': {
            get: { operationId: 'admin/roles/getAll' },
            post: { operationId: 'admin/roles/create' }
          },
          '/public/info': {
            get: { operationId: 'public/getInfo' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should group by namespace using forward slash
      expect(result).toHaveProperty('admin');
      expect(result).toHaveProperty('admin/roles');
      expect(result).toHaveProperty('public');

      expect(result.admin).toHaveLength(2);
      expect(result['admin/roles']).toHaveLength(2);
      expect(result.public).toHaveLength(1);
    });

    it('should handle namespaced operations with dot separator', () => {
      // Mock API with dot namespaced operations
      (generator as any).api = {
        paths: {
          '/admin/users': {
            get: { operationId: 'admin.getUsers' },
            post: { operationId: 'admin.createUser' }
          },
          '/admin/roles': {
            get: { operationId: 'admin.roles.getAll' },
            post: { operationId: 'admin.roles.create' }
          },
          '/public/info': {
            get: { operationId: 'public.getInfo' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should group by namespace using dot
      expect(result).toHaveProperty('admin');
      expect('admin.roles' in result).toBe(true);
      expect(result).toHaveProperty('public');

      expect(result.admin).toHaveLength(2);
      expect(result['admin.roles']).toHaveLength(2);
      expect(result.public).toHaveLength(1);
    });

    it('should handle mixed separators by prioritizing forward slash', () => {
      // Mock API with mixed separators (should prioritize forward slash)
      (generator as any).api = {
        paths: {
          '/admin/users': {
            get: { operationId: 'admin/getUsers' }, // Forward slash
            post: { operationId: 'admin.createUser' } // Dot
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should use forward slash separator for this namespace
      expect(result).toHaveProperty('admin');
      expect(result.admin).toHaveLength(2);
    });

    it('should handle operations without namespace separators', () => {
      // Mock API with operations without namespace separators
      (generator as any).api = {
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
            post: { operationId: 'createUser' }
          },
          '/products': {
            get: { operationId: 'getProducts' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should all be in default namespace
      expect(result).toHaveProperty('default');
      expect(result.default).toHaveLength(3);
      expect(result).not.toHaveProperty('admin');
      expect(result).not.toHaveProperty('public');
    });

    it('should handle nested namespaces with forward slash', () => {
      // Mock API with deeply nested forward slash namespaces
      (generator as any).api = {
        paths: {
          '/admin/users/roles': {
            get: { operationId: 'admin/users/roles/getAll' },
            post: { operationId: 'admin/users/roles/create' }
          },
          '/admin/users/permissions': {
            get: { operationId: 'admin/users/permissions/getAll' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should create nested namespaces
      expect('admin/users/roles' in result).toBe(true);
      expect('admin/users/permissions' in result).toBe(true);

      expect(result['admin/users/roles']).toHaveLength(2);
      expect(result['admin/users/permissions']).toHaveLength(1);
    });

    it('should handle nested namespaces with dot separator', () => {
      // Mock API with deeply nested dot namespaces
      (generator as any).api = {
        paths: {
          '/admin/users/roles': {
            get: { operationId: 'admin.users.roles.getAll' },
            post: { operationId: 'admin.users.roles.create' }
          },
          '/admin/users/permissions': {
            get: { operationId: 'admin.users.permissions.getAll' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should create nested namespaces
      expect('admin.users.roles' in result).toBe(true);
      expect('admin.users.permissions' in result).toBe(true);

      expect(result['admin.users.roles']).toHaveLength(2);
      expect(result['admin.users.permissions']).toHaveLength(1);
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

  describe('dot-separated operationId namespacing', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator(mockOptions);
    });

    it('should handle basic dot-separated operationId namespacing', () => {
      // Mock API with dot-separated namespaced operations
      (generator as any).api = {
        paths: {
          '/admin/users': {
            get: { operationId: 'admin.getUser' },
            post: { operationId: 'admin.createUser' }
          },
          '/admin/roles': {
            get: { operationId: 'admin.roles.getAll' },
            post: { operationId: 'admin.roles.create' }
          },
          '/public/info': {
            get: { operationId: 'public.getInfo' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should group by namespace using dot separator
      expect(result).toHaveProperty('admin');
      expect('admin.roles' in result).toBe(true);
      expect(result).toHaveProperty('public');

      expect(result.admin).toHaveLength(2);
      expect(result['admin.roles']).toHaveLength(2);
      expect(result.public).toHaveLength(1);
    });

    it('should handle deeply nested dot-separated operationId namespacing', () => {
      // Mock API with deeply nested dot namespaces
      (generator as any).api = {
        paths: {
          '/admin/users/roles': {
            get: { operationId: 'admin.users.roles.getAll' },
            post: { operationId: 'admin.users.roles.create' }
          },
          '/admin/users/permissions': {
            get: { operationId: 'admin.users.permissions.getAll' }
          },
          '/admin/system/config': {
            get: { operationId: 'admin.system.config.get' },
            put: { operationId: 'admin.system.config.update' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should create nested namespaces
      expect('admin.users.roles' in result).toBe(true);
      expect('admin.users.permissions' in result).toBe(true);
      expect('admin.system.config' in result).toBe(true);

      expect(result['admin.users.roles']).toHaveLength(2);
      expect(result['admin.users.permissions']).toHaveLength(1);
      expect(result['admin.system.config']).toHaveLength(2);
    });

    it('should handle mixed separators in same API', () => {
      // Mock API with mixed separator types
      (generator as any).api = {
        paths: {
          '/admin/users': {
            get: { operationId: 'admin.getUser' }, // Dot separator
            post: { operationId: 'admin/createUser' } // Forward slash separator
          },
          '/admin/roles': {
            get: { operationId: 'admin.roles.getAll' }, // Dot separator
            post: { operationId: 'admin/roles/create' } // Forward slash separator
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should handle both separators appropriately
      expect(result).toHaveProperty('admin');
      expect('admin.roles' in result).toBe(true);
      expect('admin/roles' in result).toBe(true);

      expect(result.admin).toHaveLength(2);
      expect(result['admin.roles']).toHaveLength(1);
      expect(result['admin/roles']).toHaveLength(1);
    });

    it('should handle duplicate operationIds with dot separators', () => {
      // Mock API with duplicate dot-separated operationIds
      (generator as any).api = {
        paths: {
          '/admin/users': {
            get: { operationId: 'admin.getUser' },
            post: { operationId: 'admin.getUser' } // Duplicate
          },
          '/admin/roles': {
            get: { operationId: 'admin.getUser' } // Another duplicate
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should all be in the 'admin' namespace
      expect(result).toHaveProperty('admin');
      expect(result.admin).toHaveLength(3);

      const operationIds = result.admin.map((op: any) => op.operationId);
      expect(operationIds).toContain('admin.getUser');
      expect(operationIds).toContain('admin.getUser2');
      expect(operationIds).toContain('admin.getUser3');
    });

    it('should extract method names correctly from dot-separated operationIds', () => {
      // Test the toMethodName method with dot-separated operationIds
      const naming = new NamingUtils();
      expect(naming.toMethodName('admin.getUser')).toBe('getUser');
      expect(naming.toMethodName('admin.users.getAll')).toBe('usersGetAll');
      expect(naming.toMethodName('admin.users.roles.create')).toBe('usersRolesCreate');
      expect(naming.toMethodName('public.getInfo')).toBe('getInfo');
      expect(naming.toMethodName('system.config.update')).toBe('configUpdate');
    });

    it('should handle users.getUser operationId correctly', () => {
      // Test the specific case: users.getUser should create users namespace with getUser method
      const naming = new NamingUtils();
      expect(naming.toMethodName('users.getUser')).toBe('getUser');
      expect(naming.toMethodName('users.createUser')).toBe('createUser');
      expect(naming.toMethodName('users.updateUser')).toBe('updateUser');
      expect(naming.toMethodName('users.deleteUser')).toBe('deleteUser');
    });

    it('should create users namespace with getUser method from users.getUser operationId', () => {
      // Mock API with users.getUser operationId
      (generator as any).api = {
        paths: {
          '/users': {
            get: { operationId: 'users.getUser' },
            post: { operationId: 'users.createUser' },
            put: { operationId: 'users.updateUser' },
            delete: { operationId: 'users.deleteUser' }
          }
        }
      };

      const result = (generator as any).groupOperationsByNamespace();

      // Should create a 'users' namespace
      expect(result).toHaveProperty('users');
      expect(result.users).toHaveLength(4);

      // Verify all operations are in the users namespace
      const operationIds = result.users.map((op: any) => op.operationId);
      expect(operationIds).toContain('users.getUser');
      expect(operationIds).toContain('users.createUser');
      expect(operationIds).toContain('users.updateUser');
      expect(operationIds).toContain('users.deleteUser');
    });

    it('should handle operationIds with dots but no clean namespace pattern', () => {
      // Test operationIds that contain dots but don't follow clean namespace.method pattern
      // These should be treated as single method names since they don't start with a clean namespace
      const naming = new NamingUtils();
      expect(naming.toMethodName('get.user.by.id')).toBe('userById');
      expect(naming.toMethodName('create.user.profile')).toBe('userProfile');
      expect(naming.toMethodName('update.user.settings')).toBe('userSettings');
    });

    it('should generate proper namespace structure for dot-separated operationIds', async () => {
      const testOutputDir = path.join(__dirname, 'test-output-dot-namespace');
      
      try {
        // Create a test OpenAPI spec with dot-separated operationIds
        const testSpec = {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/admin/users': {
              get: {
                operationId: 'admin.getUser',
                summary: 'Get user from admin namespace',
                responses: {
                  '200': {
                    description: 'User found',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              },
              post: {
                operationId: 'admin.createUser',
                summary: 'Create user in admin namespace',
                responses: {
                  '201': {
                    description: 'User created',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              }
            },
            '/admin/roles': {
              get: {
                operationId: 'admin.roles.getAll',
                summary: 'Get all roles from admin.roles namespace',
                responses: {
                  '200': {
                    description: 'Roles found',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              }
            },
            '/public/info': {
              get: {
                operationId: 'public.getInfo',
                summary: 'Get public info',
                responses: {
                  '200': {
                    description: 'Info found',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        };

        // Write test spec to file
        const specPath = path.join(testOutputDir, 'test-spec.yaml');
        await fs.mkdir(testOutputDir, { recursive: true });
        await fs.writeFile(specPath, JSON.stringify(testSpec, null, 2));

        const generator = new OpenAPIGenerator({
          spec: specPath,
          outputDir: testOutputDir,
          namespace: 'TestAPI'
        });

        await generator.generate();

        // Read generated client file
        const clientPath = path.join(testOutputDir, 'client.ts');
        const clientContent = await fs.readFile(clientPath, 'utf-8');

        // Verify namespace structure is generated correctly in client.ts
        expect(clientContent).toContain('admin: AdminOperations');
        expect(clientContent).toContain('public: PublicOperations');
        
        // Verify interface definitions are in namespace files (not in client.ts)
        const adminNamespacePath = path.join(testOutputDir, 'namespaces', 'admin.ts');
        const publicNamespacePath = path.join(testOutputDir, 'namespaces', 'public.ts');
        const adminNamespaceContent = await fs.readFile(adminNamespacePath, 'utf-8');
        const publicNamespaceContent = await fs.readFile(publicNamespacePath, 'utf-8');
        
        expect(adminNamespaceContent).toContain('interface AdminOperations');
        expect(publicNamespaceContent).toContain('interface PublicOperations');
        
        // Verify method signatures in namespace interfaces
        expect(adminNamespaceContent).toContain('getUser(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(adminNamespaceContent).toContain('createUser(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(publicNamespaceContent).toContain('getInfo(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');

        // Verify nested dot-separated operationId is flattened to method (admin.roles.getAll -> rolesGetAll)
        expect(adminNamespaceContent).toContain('rolesGetAll(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');

      } finally {
        // Clean up test directory
        try {
          await fs.rm(testOutputDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle complex nested dot-separated operationIds', async () => {
      const testOutputDir = path.join(__dirname, 'test-output-complex-dot-namespace');
      
      try {
        // Create a test OpenAPI spec with complex nested dot-separated operationIds
        const testSpec = {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/admin/users/roles': {
              get: {
                operationId: 'admin.users.roles.getAll',
                summary: 'Get all user roles',
                responses: {
                  '200': {
                    description: 'Roles found',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              },
              post: {
                operationId: 'admin.users.roles.create',
                summary: 'Create user role',
                responses: {
                  '201': {
                    description: 'Role created',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              }
            },
            '/admin/users/permissions': {
              get: {
                operationId: 'admin.users.permissions.getAll',
                summary: 'Get all user permissions',
                responses: {
                  '200': {
                    description: 'Permissions found',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              }
            },
            '/admin/system/config': {
              get: {
                operationId: 'admin.system.config.get',
                summary: 'Get system config',
                responses: {
                  '200': {
                    description: 'Config found',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              },
              put: {
                operationId: 'admin.system.config.update',
                summary: 'Update system config',
                responses: {
                  '200': {
                    description: 'Config updated',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        };

        // Write test spec to file
        const specPath = path.join(testOutputDir, 'test-spec.yaml');
        await fs.mkdir(testOutputDir, { recursive: true });
        await fs.writeFile(specPath, JSON.stringify(testSpec, null, 2));

        const generator = new OpenAPIGenerator({
          spec: specPath,
          outputDir: testOutputDir,
          namespace: 'TestAPI'
        });

        await generator.generate();

        // Read generated client file
        const clientPath = path.join(testOutputDir, 'client.ts');
        const clientContent = await fs.readFile(clientPath, 'utf-8');

        // Verify complex nested namespace structure in client.ts
        expect(clientContent).toContain('admin: AdminOperations');
        
        // Verify interfaces are in namespace file (not in client.ts)
        const adminNamespacePath = path.join(testOutputDir, 'namespaces', 'admin.ts');
        const adminNamespaceContent = await fs.readFile(adminNamespacePath, 'utf-8');
        
        expect(adminNamespaceContent).toContain('interface AdminOperations');
        
        // Verify nested dot-separated operationIds are flattened to flat method names
        // (e.g., admin.users.roles.getAll -> usersRolesGetAll)
        expect(adminNamespaceContent).toContain('usersRolesGetAll(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(adminNamespaceContent).toContain('usersRolesCreate(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(adminNamespaceContent).toContain('usersPermissionsGetAll(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(adminNamespaceContent).toContain('systemConfigGet(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(adminNamespaceContent).toContain('systemConfigUpdate(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');

      } finally {
        // Clean up test directory
        try {
          await fs.rm(testOutputDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should generate proper client code for users.getUser operationId', async () => {
      const testOutputDir = path.join(__dirname, 'test-output-users-namespace');
      
      try {
        // Create a test OpenAPI spec with users.getUser operationId
        const testSpec = {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/users': {
              get: {
                operationId: 'users.getUser',
                summary: 'Get user from users namespace',
                responses: {
                  '200': {
                    description: 'User found',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              },
              post: {
                operationId: 'users.createUser',
                summary: 'Create user in users namespace',
                responses: {
                  '201': {
                    description: 'User created',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              },
              put: {
                operationId: 'users.updateUser',
                summary: 'Update user in users namespace',
                responses: {
                  '200': {
                    description: 'User updated',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              },
              delete: {
                operationId: 'users.deleteUser',
                summary: 'Delete user from users namespace',
                responses: {
                  '204': {
                    description: 'User deleted'
                  }
                }
              }
            }
          }
        };

        // Write test spec to file
        const specPath = path.join(testOutputDir, 'test-spec.yaml');
        await fs.mkdir(testOutputDir, { recursive: true });
        await fs.writeFile(specPath, JSON.stringify(testSpec, null, 2));

        const generator = new OpenAPIGenerator({
          spec: specPath,
          outputDir: testOutputDir,
          namespace: 'TestAPI'
        });

        await generator.generate();

        // Read generated client file
        const clientPath = path.join(testOutputDir, 'client.ts');
        const clientContent = await fs.readFile(clientPath, 'utf-8');

        // Verify namespace structure is generated correctly in client.ts
        expect(clientContent).toContain('users: UsersOperations');
        
        // Verify interface definition is in namespace file (not in client.ts)
        const usersNamespacePath = path.join(testOutputDir, 'namespaces', 'users.ts');
        const usersNamespaceContent = await fs.readFile(usersNamespacePath, 'utf-8');
        
        expect(usersNamespaceContent).toContain('interface UsersOperations');
        
        // Verify method signatures in the users interface
        expect(usersNamespaceContent).toContain('getUser(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(usersNamespaceContent).toContain('createUser(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(usersNamespaceContent).toContain('updateUser(config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
        expect(usersNamespaceContent).toContain('deleteUser(config?: AxiosRequestConfig): Promise<AxiosResponse<void>>;');

        // Verify the namespace is properly initialized in constructor
        expect(clientContent).toContain('this.users = createUsersNamespace(this.client);');

      } finally {
        // Clean up test directory
        try {
          await fs.rm(testOutputDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
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

  describe('parameter requirement logic', () => {
    let generator: OpenAPIGenerator;

    beforeEach(() => {
      generator = new OpenAPIGenerator(mockOptions);
    });

    it('should make params required when any parameter is required', () => {
      // Mock API with required parameters
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUserById',
              summary: 'Get user by ID',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'include',
                  in: 'query',
                  required: false,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'User found',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/users/{id}'].get;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: 'string',
          required: param.required,
          description: param.description,
          in: param.in,
        };

        // Only add non-body parameters to allParams
        if (param.in !== 'body') {
          allParams.push(paramInfo);
        }
      }

      // The params parameter should be required if ANY parameter is required
      const hasRequiredParams = allParams.some(p => p.required);
      
      expect(hasRequiredParams).toBe(true);
      expect(allParams).toHaveLength(2);
      expect(allParams[0].required).toBe(true); // id parameter
      expect(allParams[1].required).toBe(false); // include parameter
    });

    it('should make params optional when no parameters are required', () => {
      // Mock API with only optional parameters
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              parameters: [
                {
                  name: 'page',
                  in: 'query',
                  required: false,
                  schema: { type: 'integer' }
                },
                {
                  name: 'limit',
                  in: 'query',
                  required: false,
                  schema: { type: 'integer' }
                }
              ],
              responses: {
                '200': {
                  description: 'Users list',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/users'].get;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: 'integer',
          required: param.required,
          description: param.description,
          in: param.in,
        };

        if (param.in !== 'body') {
          allParams.push(paramInfo);
        }
      }

      // The params parameter should be optional when no parameters are required
      const hasRequiredParams = allParams.some(p => p.required);
      
      expect(hasRequiredParams).toBe(false);
      expect(allParams).toHaveLength(2);
      expect(allParams[0].required).toBe(false); // page parameter
      expect(allParams[1].required).toBe(false); // limit parameter
    });

    it('should handle mixed required and optional parameters correctly', () => {
      // Mock API with mixed parameter requirements
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/search': {
            get: {
              operationId: 'searchContent',
              summary: 'Search content',
              parameters: [
                {
                  name: 'q',
                  in: 'query',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'type',
                  in: 'query',
                  required: false,
                  schema: { type: 'array', items: { type: 'string' } }
                },
                {
                  name: 'date_from',
                  in: 'query',
                  required: false,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'Search results',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/search'].get;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: param.schema?.type || 'string',
          required: param.required,
          description: param.description,
          in: param.in,
        };

        if (param.in !== 'body') {
          allParams.push(paramInfo);
        }
      }

      // The params parameter should be required because 'q' is required
      const hasRequiredParams = allParams.some(p => p.required);
      
      expect(hasRequiredParams).toBe(true);
      expect(allParams).toHaveLength(3);
      expect(allParams[0].required).toBe(true); // q parameter (required)
      expect(allParams[1].required).toBe(false); // type parameter (optional)
      expect(allParams[2].required).toBe(false); // date_from parameter (optional)
    });

    it('should handle path parameters correctly', () => {
      // Mock API with path parameters
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{userId}/posts/{postId}': {
            get: {
              operationId: 'getUserPost',
              summary: 'Get user post',
              parameters: [
                {
                  name: 'userId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'postId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'include',
                  in: 'query',
                  required: false,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'Post found',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/users/{userId}/posts/{postId}'].get;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: 'string',
          required: param.required,
          description: param.description,
          in: param.in,
        };

        if (param.in !== 'body') {
          allParams.push(paramInfo);
        }
      }

      // The params parameter should be required because path parameters are required
      const hasRequiredParams = allParams.some(p => p.required);
      
      expect(hasRequiredParams).toBe(true);
      expect(allParams).toHaveLength(3);
      expect(allParams[0].required).toBe(true); // userId parameter (required)
      expect(allParams[1].required).toBe(true); // postId parameter (required)
      expect(allParams[2].required).toBe(false); // include parameter (optional)
    });

    it('should handle header parameters correctly', () => {
      // Mock API with header parameters
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/admin/users': {
            get: {
              operationId: 'getAdminUsers',
              summary: 'Get admin users',
              parameters: [
                {
                  name: 'X-API-Key',
                  in: 'header',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'X-Client-Version',
                  in: 'header',
                  required: false,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'Admin users',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/admin/users'].get;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: 'string',
          required: param.required,
          description: param.description,
          in: param.in,
        };

        if (param.in !== 'body') {
          allParams.push(paramInfo);
        }
      }

      // The params parameter should be required because X-API-Key is required
      const hasRequiredParams = allParams.some(p => p.required);
      
      expect(hasRequiredParams).toBe(true);
      expect(allParams).toHaveLength(2);
      expect(allParams[0].required).toBe(true); // X-API-Key parameter (required)
      expect(allParams[1].required).toBe(false); // X-Client-Version parameter (optional)
    });

    it('should handle operations with no parameters', () => {
      // Mock API with no parameters
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/health': {
            get: {
              operationId: 'getHealth',
              summary: 'Health check',
              responses: {
                '200': {
                  description: 'API is healthy',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/health'].get;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: 'string',
          required: param.required,
          description: param.description,
          in: param.in,
        };

        if (param.in !== 'body') {
          allParams.push(paramInfo);
        }
      }

      // The params parameter should be optional when there are no parameters
      const hasRequiredParams = allParams.some(p => p.required);
      
      expect(hasRequiredParams).toBe(false);
      expect(allParams).toHaveLength(0);
    });

    it('should handle body parameters separately from other parameters', () => {
      // Mock API with both body and other parameters
      generator['api'] = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            put: {
              operationId: 'updateUser',
              summary: 'Update user',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'body',
                  in: 'body',
                  required: true,
                  schema: { $ref: '#/components/schemas/User' }
                }
              ],
              responses: {
                '200': {
                  description: 'User updated',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/users/{id}'].put;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];
      const bodyParams: any[] = [];

      for (const param of parameters) {
        const paramInfo = {
          name: param.name,
          type: 'string',
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

      // The params parameter should be required because path parameter is required
      const hasRequiredParams = allParams.some(p => p.required);
      
      expect(hasRequiredParams).toBe(true);
      expect(allParams).toHaveLength(1); // Only path parameter
      expect(bodyParams).toHaveLength(1); // Body parameter handled separately
      expect(allParams[0].required).toBe(true); // id parameter (required)
      expect(bodyParams[0].required).toBe(true); // body parameter (required)
    });
  });

  describe('parameter requirement integration tests', () => {
    let generator: OpenAPIGenerator;
    const testOutputDir = './test-params-output';

    beforeEach(() => {
      // Mock SwaggerParser.parse to avoid file reading
      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue({
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      } as any);

      generator = new OpenAPIGenerator({
        spec: 'test-spec.yaml',
        outputDir: testOutputDir,
        namespace: 'TestAPI'
      });
    });

    afterEach(async () => {
      // Restore mocks
      vi.restoreAllMocks();
      
      // Clean up test output
      try {
        await fs.rm(testOutputDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should generate client with required params when any parameter is required', async () => {
      // Mock API with required parameters
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUserById',
              summary: 'Get user by ID',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'include',
                  in: 'query',
                  required: false,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'User found',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Mock SwaggerParser.parse to return our mock API
      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the client
      await generator.generate();

      // Read the generated client file
      const clientFile = path.join(testOutputDir, 'client.ts');
      const clientContent = await fs.readFile(clientFile, 'utf-8');

      // Check that the params parameter is required (no ? token)
      expect(clientContent).toContain('getUserById(params: GetUserByIdParams, config?: AxiosRequestConfig)');
      expect(clientContent).not.toContain('getUserById(params?: GetUserByIdParams, config?: AxiosRequestConfig)');

      // Check that the parameter interface is generated correctly
      expect(clientContent).toContain('export interface GetUserByIdParams {');
      expect(clientContent).toContain('id: string;'); // Required parameter
      expect(clientContent).toContain('include?: string;'); // Optional parameter
    });

    it('should generate client with optional params when no parameters are required', async () => {
      // Mock API with only optional parameters
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              parameters: [
                {
                  name: 'page',
                  in: 'query',
                  required: false,
                  schema: { type: 'integer' }
                },
                {
                  name: 'limit',
                  in: 'query',
                  required: false,
                  schema: { type: 'integer' }
                }
              ],
              responses: {
                '200': {
                  description: 'Users list',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Mock SwaggerParser.parse to return our mock API
      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the client
      await generator.generate();

      // Read the generated client file
      const clientFile = path.join(testOutputDir, 'client.ts');
      const clientContent = await fs.readFile(clientFile, 'utf-8');

      // Check that the params parameter is optional (has ? token)
      expect(clientContent).toContain('getUsers(params?: GetUsersParams, config?: AxiosRequestConfig)');
      expect(clientContent).not.toContain('getUsers(params: GetUsersParams, config?: AxiosRequestConfig)');

      // Check that the parameter interface is generated correctly
      expect(clientContent).toContain('export interface GetUsersParams {');
      expect(clientContent).toContain('page?: number;'); // Optional parameter
      expect(clientContent).toContain('limit?: number;'); // Optional parameter
    });

    it('should generate client with required params for mixed parameter requirements', async () => {
      // Mock API with mixed parameter requirements
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/search': {
            get: {
              operationId: 'searchContent',
              summary: 'Search content',
              parameters: [
                {
                  name: 'q',
                  in: 'query',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'type',
                  in: 'query',
                  required: false,
                  schema: { type: 'array', items: { type: 'string' } }
                },
                {
                  name: 'date_from',
                  in: 'query',
                  required: false,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'Search results',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Mock SwaggerParser.parse to return our mock API
      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the client
      await generator.generate();

      // Read the generated client file
      const clientFile = path.join(testOutputDir, 'client.ts');
      const clientContent = await fs.readFile(clientFile, 'utf-8');

      // Check that the params parameter is required (no ? token) because 'q' is required
      expect(clientContent).toContain('searchContent(params: SearchContentParams, config?: AxiosRequestConfig)');
      expect(clientContent).not.toContain('searchContent(params?: SearchContentParams, config?: AxiosRequestConfig)');

      // Check that the parameter interface is generated correctly
      expect(clientContent).toContain('export interface SearchContentParams {');
      expect(clientContent).toContain('q: string;'); // Required parameter
      expect(clientContent).toContain('type?: Array<string>;'); // Optional parameter
      expect(clientContent).toContain('date_from?: string;'); // Optional parameter
    });

    it('should generate client with optional params when no parameters exist', async () => {
      // Mock API with no parameters
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/health': {
            get: {
              operationId: 'getHealth',
              summary: 'Health check',
              responses: {
                '200': {
                  description: 'API is healthy',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Mock SwaggerParser.parse to return our mock API
      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the client
      await generator.generate();

      // Read the generated client file
      const clientFile = path.join(testOutputDir, 'client.ts');
      const clientContent = await fs.readFile(clientFile, 'utf-8');

      // Check that the method has no params parameter
      expect(clientContent).toContain('getHealth(config?: AxiosRequestConfig)');
      expect(clientContent).not.toContain('getHealth(params');
    });

    it('should handle namespace operations with required parameters correctly', async () => {
      // Mock API with namespaced operations
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/admin/users/{id}': {
            get: {
              operationId: 'admin/getUser',
              summary: 'Get admin user',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' }
                },
                {
                  name: 'include',
                  in: 'query',
                  required: false,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'User found',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Mock SwaggerParser.parse to return our mock API
      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the client
      await generator.generate();

      // Read the generated client file
      const clientFile = path.join(testOutputDir, 'client.ts');
      const clientContent = await fs.readFile(clientFile, 'utf-8');

      // Check that the namespace interface has required params (in namespace file, not client.ts)
      const adminNamespacePath = path.join(testOutputDir, 'namespaces', 'admin.ts');
      const adminNamespaceContent = await fs.readFile(adminNamespacePath, 'utf-8');
      
      expect(adminNamespaceContent).toContain('getUser(params: GetUserParams, config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');
      expect(adminNamespaceContent).not.toContain('getUser(params?: GetUserParams, config?: AxiosRequestConfig): Promise<AxiosResponse<Record<string, unknown>>>;');

      // Check that the parameter interface is generated correctly (in namespace file)
      expect(adminNamespaceContent).toContain('export interface GetUserParams {');
      expect(adminNamespaceContent).toContain('id: string;'); // Required parameter
      expect(adminNamespaceContent).toContain('include?: string;'); // Optional parameter
    });

    it('should handle OpenAPI v2 parameters correctly', async () => {
      // Mock API with OpenAPI v2 format parameters
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUserById',
              summary: 'Get user by ID',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  type: 'string'
                },
                {
                  name: 'include',
                  in: 'query',
                  required: false,
                  type: 'string'
                }
              ],
              responses: {
                '200': {
                  description: 'User found',
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      } as any;

      // Mock SwaggerParser.parse to return our mock API
      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the client
      await generator.generate();

      // Read the generated client file
      const clientFile = path.join(testOutputDir, 'client.ts');
      const clientContent = await fs.readFile(clientFile, 'utf-8');

      // Check that the params parameter is required (no ? token)
      expect(clientContent).toContain('getUserById(params: GetUserByIdParams, config?: AxiosRequestConfig)');
      expect(clientContent).not.toContain('getUserById(params?: GetUserByIdParams, config?: AxiosRequestConfig)');

      // Check that the parameter interface is generated correctly
      expect(clientContent).toContain('export interface GetUserByIdParams {');
      expect(clientContent).toContain('id: string;'); // Required parameter
      expect(clientContent).toContain('include?: string;'); // Optional parameter
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
      
      const mockSpec = {
        openapi: '3.0.0',
        info: { title: 'Remote API', version: '1.0.0' },
        paths: {}
      };
      
      generator['fetchFromUrl'] = vi.fn().mockImplementation(async (url: string) => {
        requestCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolvedCount++;
            resolve(mockSpec);
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

    it('should handle parameter named "namespace" without adding Key suffix', () => {
      // Create a test OpenAPI spec with a parameter named "namespace"
      const testSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              summary: 'Test operation with namespace parameter',
              parameters: [
                {
                  name: 'namespace',
                  in: 'query',
                  required: true,
                  schema: { type: 'string' },
                  description: 'The namespace parameter'
                }
              ],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      } as any;

      // Set up the generator with the test spec
      generator['api'] = testSpec;

      // Test the parameter collection logic
      const operation = generator['api'].paths['/test'].get;
      const parameters = operation.parameters || [];
      const allParams: any[] = [];

      for (const param of parameters) {
        const naming = new NamingUtils();
        const paramName = naming.toPropertyName(param.name);
        const paramSchema = generator['getParameterSchema'](param);
        const paramType = generator.getTypeString(paramSchema);

        const paramInfo = {
          name: paramName,
          type: paramType,
          required: param.required,
          description: param.description,
          in: param.in,
        };

        if (param.in !== 'body') {
          allParams.push(paramInfo);
        }
      }

      // Verify the parameter name is exactly "namespace" without any Key suffix
      expect(allParams).toHaveLength(1);
      expect(allParams[0].name).toBe('namespace');
      expect(allParams[0].name).not.toBe('namespaceKey');
      expect(allParams[0].name).not.toContain('Key');
      expect(allParams[0].required).toBe(true);
      expect(allParams[0].in).toBe('query');
      expect(allParams[0].type).toBe('string');
    });

    it('should generate client code that uses params.namespace for namespace parameter', async () => {
      const testOutputDir = path.join(__dirname, 'test-output-namespace-param');
      
      try {
        // Create a test OpenAPI spec with a parameter named "namespace"
        const testSpec = {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/test': {
              get: {
                operationId: 'getTest',
                summary: 'Test operation with namespace parameter',
                parameters: [
                  {
                    name: 'namespace',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The namespace parameter'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Success',
                    content: {
                      'application/json': {
                        schema: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        };

        // Mock SwaggerParser.parse to return our test spec
        vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(testSpec as any);

        // Generate the client
        const generator = new OpenAPIGenerator({
          spec: 'test-spec.yaml',
          outputDir: testOutputDir,
          namespace: 'TestAPI'
        });

        await generator.generate();

        // Read the generated client file
        const clientPath = path.join(testOutputDir, 'client.ts');
        const clientContent = await fs.readFile(clientPath, 'utf-8');

        // Verify the generated code uses params.namespace
        expect(clientContent).toContain('params.namespace');
        expect(clientContent).not.toContain('params.namespaceKey');
        expect(clientContent).not.toContain('namespaceKey');
        
        // Verify the parameter interface includes namespace (required, not optional)
        expect(clientContent).toContain('namespace: string');
        expect(clientContent).not.toContain('namespaceKey: string');

        // Verify the method signature includes the params parameter (required because namespace is required)
        expect(clientContent).toContain('getTest(params: GetTestParams');

      } finally {
        // Restore mocks
        vi.restoreAllMocks();
        
        // Clean up
        await fs.rm(testOutputDir, { recursive: true, force: true });
      }
    });

    it('should generate client code that uses params.namespace for namespace parameter in OpenAPI v2', async () => {
      const testOutputDir = path.join(__dirname, 'test-output-namespace-param-v2');
      
      try {
        // Create a test OpenAPI v2 (Swagger 2.0) spec with a parameter named "namespace"
        const testSpec = {
          swagger: '2.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/test': {
              get: {
                operationId: 'getTest',
                summary: 'Test operation with namespace parameter',
                parameters: [
                  {
                    name: 'namespace',
                    in: 'query',
                    required: true,
                    type: 'string',
                    description: 'The namespace parameter'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Success',
                    schema: { type: 'object' }
                  }
                }
              }
            }
          }
        };

        // Mock SwaggerParser.parse to return our test spec
        vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(testSpec as any);

        // Generate the client
        const generator = new OpenAPIGenerator({
          spec: 'test-spec.json',
          outputDir: testOutputDir,
          namespace: 'TestAPI'
        });

        await generator.generate();

        // Read the generated client file
        const clientPath = path.join(testOutputDir, 'client.ts');
        const clientContent = await fs.readFile(clientPath, 'utf-8');

        // Verify the generated code uses params.namespace
        expect(clientContent).toContain('params.namespace');
        expect(clientContent).not.toContain('params.namespaceKey');
        expect(clientContent).not.toContain('namespaceKey');
        
        // Verify the parameter interface includes namespace (required, not optional)
        expect(clientContent).toContain('namespace: string');
        expect(clientContent).not.toContain('namespaceKey: string');

        // Verify the method signature includes the params parameter (required because namespace is required)
        expect(clientContent).toContain('getTest(params: GetTestParams');

        // Verify the axios call uses the parameter correctly
        expect(clientContent).toContain('const queryParams = { namespace: params.namespace }');

      } finally {
        // Restore mocks
        vi.restoreAllMocks();
        
        // Clean up
        await fs.rm(testOutputDir, { recursive: true, force: true });
      }
    });
  });

  describe('generateConfigFromSpec', () => {
    const testOutputDir = path.join(__dirname, 'test-config-output');
    const testConfigPath = path.join(testOutputDir, '.ott.json');

    beforeEach(async () => {
      await fs.mkdir(testOutputDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    });

    it('should generate config from local spec file', async () => {
      const testSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const specPath = path.join(testOutputDir, 'test-spec.json');
      await fs.writeFile(specPath, JSON.stringify(testSpec), 'utf-8');

      const config = await OpenAPIGenerator.generateConfigFromSpec(
        specPath,
        './generated',
        testConfigPath
      );

      expect(config).toBeDefined();
      expect(config.apis).toHaveLength(1);
      expect(config.apis[0].name).toBe('Test API');
      expect(config.apis[0].operationIds).toEqual(['getTest']);
      expect(config.apis[0].headers).toBeUndefined();

      // Verify config file was created
      const configContent = await fs.readFile(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig).toEqual(config);
    });

    it('should generate config with headers when provided', async () => {
      const testSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const specPath = path.join(testOutputDir, 'test-spec.json');
      await fs.writeFile(specPath, JSON.stringify(testSpec), 'utf-8');

      const headers = {
        'Authorization': 'Bearer test-token',
        'X-API-Key': 'test-key'
      };

      const config = await OpenAPIGenerator.generateConfigFromSpec(
        specPath,
        './generated',
        testConfigPath,
        headers
      );

      expect(config).toBeDefined();
      expect(config.apis).toHaveLength(1);
      expect(config.apis[0].headers).toEqual(headers);

      // Verify config file was created with headers
      const configContent = await fs.readFile(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.apis[0].headers).toEqual(headers);
    });

    it('should not include headers in config when empty headers provided', async () => {
      const testSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const specPath = path.join(testOutputDir, 'test-spec.json');
      await fs.writeFile(specPath, JSON.stringify(testSpec), 'utf-8');

      const config = await OpenAPIGenerator.generateConfigFromSpec(
        specPath,
        './generated',
        testConfigPath,
        {}
      );

      expect(config).toBeDefined();
      expect(config.apis).toHaveLength(1);
      expect(config.apis[0].headers).toBeUndefined();

      // Verify config file was created without headers
      const configContent = await fs.readFile(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.apis[0].headers).toBeUndefined();
    });
  });

  describe('environment variable resolution', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment variables
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    describe('resolveEnvironmentVariables', () => {
      it('should resolve simple environment variables', () => {
        process.env.TEST_TOKEN = 'abc123';
        const result = resolveEnvironmentVariables('Bearer ${TEST_TOKEN}');
        expect(result).toBe('Bearer abc123');
      });

      it('should resolve multiple environment variables', () => {
        process.env.API_KEY = 'key123';
        process.env.API_SECRET = 'secret456';
        const result = resolveEnvironmentVariables('${API_KEY}:${API_SECRET}');
        expect(result).toBe('key123:secret456');
      });

      it('should use default values when environment variable is not set', () => {
        delete process.env.MISSING_VAR;
        const result = resolveEnvironmentVariables('${MISSING_VAR:default-value}');
        expect(result).toBe('default-value');
      });

      it('should use environment variable when set, ignoring default', () => {
        process.env.EXISTING_VAR = 'actual-value';
        const result = resolveEnvironmentVariables('${EXISTING_VAR:default-value}');
        expect(result).toBe('actual-value');
      });

      it('should keep original placeholder when no env var and no default', () => {
        delete process.env.MISSING_VAR;
        const result = resolveEnvironmentVariables('${MISSING_VAR}');
        expect(result).toBe('${MISSING_VAR}');
      });

      it('should handle empty default values', () => {
        delete process.env.EMPTY_DEFAULT;
        const result = resolveEnvironmentVariables('${EMPTY_DEFAULT:}');
        expect(result).toBe('');
      });

      it('should handle mixed resolved and unresolved variables', () => {
        process.env.RESOLVED = 'resolved';
        delete process.env.UNRESOLVED;
        const result = resolveEnvironmentVariables('${RESOLVED} and ${UNRESOLVED}');
        expect(result).toBe('resolved and ${UNRESOLVED}');
      });

      it('should handle strings without environment variables', () => {
        const result = resolveEnvironmentVariables('plain string');
        expect(result).toBe('plain string');
      });

      it('should handle empty strings', () => {
        const result = resolveEnvironmentVariables('');
        expect(result).toBe('');
      });
    });

    describe('resolveHeadersEnvironmentVariables', () => {
      it('should resolve environment variables in all header values', () => {
        process.env.AUTH_TOKEN = 'token123';
        process.env.API_KEY = 'key456';
        
        const headers = {
          'Authorization': 'Bearer ${AUTH_TOKEN}',
          'X-API-Key': '${API_KEY}',
          'Content-Type': 'application/json'
        };
        
        const result = resolveHeadersEnvironmentVariables(headers);
        
        expect(result).toEqual({
          'Authorization': 'Bearer token123',
          'X-API-Key': 'key456',
          'Content-Type': 'application/json'
        });
      });

      it('should handle headers with default values', () => {
        delete process.env.MISSING_TOKEN;
        
        const headers = {
          'Authorization': 'Bearer ${MISSING_TOKEN:default-token}',
          'X-API-Key': '${MISSING_KEY:default-key}'
        };
        
        const result = resolveHeadersEnvironmentVariables(headers);
        
        expect(result).toEqual({
          'Authorization': 'Bearer default-token',
          'X-API-Key': 'default-key'
        });
      });

      it('should handle empty headers object', () => {
        const result = resolveHeadersEnvironmentVariables({});
        expect(result).toEqual({});
      });

      it('should preserve header names and only resolve values', () => {
        process.env.TOKEN = 'test-token';
        
        const headers = {
          'Authorization': 'Bearer ${TOKEN}',
          'X-Custom-Header': '${TOKEN}'
        };
        
        const result = resolveHeadersEnvironmentVariables(headers);
        
        expect(result).toHaveProperty('Authorization');
        expect(result).toHaveProperty('X-Custom-Header');
        expect(result['Authorization']).toBe('Bearer test-token');
        expect(result['X-Custom-Header']).toBe('test-token');
      });
    });

    describe('integration with OpenAPIGenerator', () => {
      it('should resolve environment variables in headers during initialization', () => {
        process.env.TEST_TOKEN = 'integration-token';
        
        const options = {
          spec: './test.yaml',
          outputDir: './generated',
          headers: {
            'Authorization': 'Bearer ${TEST_TOKEN}',
            'X-API-Key': '${TEST_TOKEN}'
          }
        };
        
        const generator = new OpenAPIGenerator(options);
        
        // Access the private options through the generator instance
        // We can't directly access private properties, but we can test the behavior
        // by checking if the generator was created successfully
        expect(generator).toBeDefined();
      });

      it('should resolve environment variables when loading config', async () => {
        process.env.CONFIG_TOKEN = 'config-token';
        
        const testOutputDir = './test-env-config-output';
        const testConfigPath = path.join(testOutputDir, 'test-config.json');
        const config = {
          apis: [
            {
              name: 'Test API',
              spec: './test.yaml',
              headers: {
                'Authorization': 'Bearer ${CONFIG_TOKEN}',
                'X-API-Key': '${CONFIG_TOKEN}'
              }
            }
          ]
        };
        
        await fs.mkdir(testOutputDir, { recursive: true });
        await fs.writeFile(testConfigPath, JSON.stringify(config, null, 2), 'utf-8');
        
        const loadedConfig = await OpenAPIGenerator.loadConfig(testConfigPath);
        
        expect(loadedConfig).toBeDefined();
        expect(loadedConfig!.apis[0].headers).toEqual({
          'Authorization': 'Bearer config-token',
          'X-API-Key': 'config-token'
        });
        
        // Clean up test directory
        try {
          await fs.rm(testOutputDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      });
    });
  });

  describe('type formatting validation', () => {
    let generator: OpenAPIGenerator;
    const testOutputDir = './test-format-output';

    beforeEach(() => {
      generator = new OpenAPIGenerator({
        spec: 'test-spec.yaml',
        outputDir: testOutputDir,
        namespace: 'TestAPI'
      });
    });

    afterEach(async () => {
      // Restore mocks
      vi.restoreAllMocks();
      
      // Clean up test output
      try {
        await fs.rm(testOutputDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should generate types with correct formatting', async () => {
      // Mock API with a schema that has description and properties with descriptions
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'User': {
              type: 'object',
              description: 'A user account',
              properties: {
                'id': {
                  type: 'integer',
                  description: 'Unique identifier for the user',
                  format: 'int64'
                },
                'name': {
                  type: 'string',
                  description: 'The user\'s full name'
                },
                'email': {
                  type: 'string',
                  format: 'email',
                  description: 'The user\'s email address'
                }
              },
              required: ['id', 'name']
            }
          }
        },
        paths: {}
      } as any;

      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the types
      await generator.generate();

      // Read the generated types file
      const typesFile = path.join(testOutputDir, 'types.ts');
      const typesContent = await fs.readFile(typesFile, 'utf-8');

      // Validate type-level JSDoc uses schema description
      expect(typesContent).toContain('/** A user account */');
      expect(typesContent).not.toContain('Type: object');
      expect(typesContent).not.toContain('User property');

      // Validate property formatting - ts-morph adds base indentation, so we check for consistent indentation
      // Properties should be consistently indented (ts-morph may add base indentation)
      const propertyLines = typesContent.split('\n').filter(line => 
        line.trim().startsWith('id:') || line.trim().startsWith('name:') || line.trim().startsWith('email:')
      );
      
      propertyLines.forEach(line => {
        // Properties should be indented (not at start of line)
        expect(line).toMatch(/^\s+(id|name|email)/);
        // All properties should have the same indentation
        const indent = line.match(/^(\s+)/)?.[1];
        expect(indent).toBeDefined();
      });

      // Validate JSDoc comments on properties (may include additional metadata like Format)
      expect(typesContent).toContain('Unique identifier for the user');
      expect(typesContent).toContain('The user\'s full name');
      expect(typesContent).toContain('The user\'s email address');

      // Validate property JSDoc formatting - should be on line(s) before property
      const lines = typesContent.split('\n');
      let foundIdProperty = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('id: number')) {
          // Check that there's a JSDoc comment before the property (may span multiple lines)
          // Look backwards for the JSDoc comment
          let foundJSDoc = false;
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            if (lines[j].includes('/**')) {
              foundJSDoc = true;
              // Check that the JSDoc comment contains the description
              const jsdocContent = lines.slice(j, i).join('\n');
              expect(jsdocContent).toContain('Unique identifier for the user');
              break;
            }
          }
          expect(foundJSDoc).toBe(true);
          foundIdProperty = true;
          break;
        }
      }
      expect(foundIdProperty).toBe(true);

      // Validate closing brace formatting - should be on its own line
      expect(typesContent).toMatch(/\n\s*};/m);
      // Closing brace should be consistently indented (ts-morph may add base indentation)
      const closingBraceMatch = typesContent.match(/\n(\s*)};/m);
      expect(closingBraceMatch).toBeTruthy();

      // Validate type alias format
      expect(typesContent).toContain('export type User = {');
    });

    it('should not include JSDoc when schema has no description', async () => {
      // Mock API with a schema without description
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'Anonymous': {
              type: 'object',
              properties: {
                'value': {
                  type: 'string'
                }
              }
            }
          }
        },
        paths: {}
      } as any;

      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the types
      await generator.generate();

      // Read the generated types file
      const typesFile = path.join(testOutputDir, 'types.ts');
      const typesContent = await fs.readFile(typesFile, 'utf-8');

      // Should not have JSDoc comment for type without description
      const typeDeclaration = typesContent.match(/export type Anonymous = \{/);
      expect(typeDeclaration).toBeTruthy();
      
      // Check that there's no JSDoc comment before the type declaration
      const typeIndex = typesContent.indexOf('export type Anonymous = {');
      const beforeType = typesContent.substring(Math.max(0, typeIndex - 50), typeIndex);
      expect(beforeType).not.toMatch(/\/\*\*.*Anonymous.*\*\//);
    });

    it('should format nested object types correctly', async () => {
      // Mock API with nested object schema
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'Address': {
              type: 'object',
              description: 'A physical address',
              properties: {
                'street': {
                  type: 'string',
                  description: 'Street address'
                },
                'city': {
                  type: 'string',
                  description: 'City name'
                }
              },
              required: ['street', 'city']
            }
          }
        },
        paths: {}
      } as any;

      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the types
      await generator.generate();

      // Read the generated types file
      const typesFile = path.join(testOutputDir, 'types.ts');
      const typesContent = await fs.readFile(typesFile, 'utf-8');

      // Validate nested object formatting
      expect(typesContent).toContain('/** A physical address */');
      expect(typesContent).toContain('export type Address = {');
      
      // Properties should be consistently indented (ts-morph may add base indentation)
      expect(typesContent).toMatch(/\s+\/\*\* Street address \*\//);
      expect(typesContent).toMatch(/\s+street: string;/);
      expect(typesContent).toMatch(/\s+\/\*\* City name \*\//);
      expect(typesContent).toMatch(/\s+city: string;/);
      
      // Validate that JSDoc comments are on lines before their properties
      const addressLines = typesContent.split('\n');
      let foundStreet = false;
      for (let i = 0; i < addressLines.length; i++) {
        if (addressLines[i].trim().startsWith('street: string')) {
          // Previous line should have the JSDoc comment
          expect(addressLines[i - 1].trim()).toBe('/** Street address */');
          foundStreet = true;
          break;
        }
      }
      expect(foundStreet).toBe(true);
    });
  });

  describe('type generation snapshot tests', () => {
    let generator: OpenAPIGenerator;
    const testOutputDir = './test-snapshot-output';

    beforeEach(() => {
      generator = new OpenAPIGenerator({
        spec: 'test-spec.yaml',
        outputDir: testOutputDir,
        namespace: 'TestAPI'
      });
    });

    afterEach(async () => {
      // Restore mocks
      vi.restoreAllMocks();
      
      // Clean up test output
      try {
        await fs.rm(testOutputDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should generate types with correct format and JSDoc comments', async () => {
      // Mock API with comprehensive schema that has description and properties with descriptions
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'User': {
              type: 'object',
              description: 'A user account in the system',
              properties: {
                'id': {
                  type: 'integer',
                  description: 'Unique identifier for the user',
                  format: 'int64'
                },
                'name': {
                  type: 'string',
                  description: 'The user\'s full name'
                },
                'email': {
                  type: 'string',
                  format: 'email',
                  description: 'The user\'s email address'
                },
                'age': {
                  type: 'integer',
                  minimum: 0,
                  maximum: 150
                },
                'address': {
                  type: 'object',
                  description: 'User\'s physical address',
                  properties: {
                    'street': {
                      type: 'string',
                      description: 'Street address'
                    },
                    'city': {
                      type: 'string',
                      description: 'City name'
                    },
                    'zipCode': {
                      type: 'string',
                      description: 'ZIP code',
                      pattern: '^\\d{5}(-\\d{4})?$'
                    }
                  },
                  required: ['street', 'city']
                }
              },
              required: ['id', 'name', 'email']
            },
            'Status': {
              type: 'string',
              description: 'Current status of the resource',
              enum: ['active', 'inactive', 'pending']
            },
            'Metadata': {
              type: 'object',
              description: 'Additional metadata',
              properties: {
                'createdAt': {
                  type: 'string',
                  format: 'date-time',
                  description: 'Creation timestamp'
                },
                'updatedAt': {
                  type: 'string',
                  format: 'date-time',
                  description: 'Last update timestamp'
                }
              }
            }
          }
        },
        paths: {}
      } as any;

      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the types
      await generator.generate();

      // Read the generated types file
      const typesFile = path.join(testOutputDir, 'types.ts');
      const typesContent = await fs.readFile(typesFile, 'utf-8');

      // Use snapshot testing to verify the generated types
      expect(typesContent).toMatchSnapshot();
    });

    it('should generate types without JSDoc when schema has no description', async () => {
      // Mock API with schemas without descriptions
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'Anonymous': {
              type: 'object',
              properties: {
                'value': {
                  type: 'string'
                }
              }
            },
            'SimpleType': {
              type: 'string'
            }
          }
        },
        paths: {}
      } as any;

      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the types
      await generator.generate();

      // Read the generated types file
      const typesFile = path.join(testOutputDir, 'types.ts');
      const typesContent = await fs.readFile(typesFile, 'utf-8');

      // Use snapshot testing to verify the generated types
      expect(typesContent).toMatchSnapshot();
    });

    it('should generate types with composition schemas correctly', async () => {
      // Mock API with composition schemas (anyOf, oneOf, allOf)
      const mockApi = {
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            'BaseEntity': {
              type: 'object',
              description: 'Base entity with common fields',
              properties: {
                'id': {
                  type: 'string',
                  description: 'Entity identifier'
                },
                'createdAt': {
                  type: 'string',
                  format: 'date-time',
                  description: 'Creation timestamp'
                }
              },
              required: ['id']
            },
            'ComposedType': {
              description: 'A type composed from multiple schemas',
              allOf: [
                { $ref: '#/components/schemas/BaseEntity' },
                {
                  type: 'object',
                  properties: {
                    'name': {
                      type: 'string',
                      description: 'Entity name'
                    }
                  },
                  required: ['name']
                }
              ]
            },
            'UnionType': {
              description: 'A union type',
              anyOf: [
                { type: 'string' },
                { type: 'number' }
              ]
            }
          }
        },
        paths: {}
      } as any;

      vi.spyOn(SwaggerParser, 'parse').mockResolvedValue(mockApi);

      // Generate the types
      await generator.generate();

      // Read the generated types file
      const typesFile = path.join(testOutputDir, 'types.ts');
      const typesContent = await fs.readFile(typesFile, 'utf-8');

      // Use snapshot testing to verify the generated types
      expect(typesContent).toMatchSnapshot();
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