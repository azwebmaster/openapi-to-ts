import { NamingUtils } from '../utils/naming.js';

export interface SchemaUtilsContext {
  naming: NamingUtils;
  typeStringCache: Map<string, string>;
  getTypeString: (schema: any) => string;
}

export class SchemaUtils {
  constructor(private ctx: SchemaUtilsContext) {}

  getTypeString(schema: any): string {
    if (!schema) return 'unknown';

    // Create a cache key from the schema
    // For $ref, use the ref directly as the key
    if (schema.$ref) {
      const cacheKey = `ref:${schema.$ref}`;
      if (this.ctx.typeStringCache.has(cacheKey)) {
        return this.ctx.typeStringCache.get(cacheKey)!;
      }
      const refName = schema.$ref.split('/').pop();
      const result = this.ctx.naming.toTypeName(refName);
      this.ctx.typeStringCache.set(cacheKey, result);
      return result;
    }

    // For other schemas, use JSON string as cache key (excluding $ref)
    // We need to be careful with circular references, so we'll cache by structure
    const schemaKey = this.getSchemaCacheKey(schema);
    if (schemaKey && this.ctx.typeStringCache.has(schemaKey)) {
      return this.ctx.typeStringCache.get(schemaKey)!;
    }

    let result: string;

    // Handle composition schemas
    if (schema.anyOf) {
      const types = schema.anyOf.map((s: any) => this.getTypeString(s));
      result = `(${types.join(' | ')})`;
    } else if (schema.oneOf) {
      const types = schema.oneOf.map((s: any) => this.getTypeString(s));
      // Handle discriminated unions
      if (schema.discriminator) {
        result = this.generateDiscriminatedUnion(schema, types);
      } else {
        result = `(${types.join(' | ')})`;
      }
    } else if (schema.allOf) {
      const types = schema.allOf.map((s: any) => this.getTypeString(s));
      result = `(${types.join(' & ')})`;
    } else if (schema.type && Array.isArray(schema.type)) {
      // Handle nullable types (OpenAPI 3.1)
      const types = schema.type.map((t: string) => {
        if (t === 'null') return 'null';
        return this.getPrimitiveType(t, schema);
      });
      result = types.join(' | ');
    } else if (schema.const !== undefined) {
      // Handle const values (OpenAPI 3.1)
      result = this.handleConst(schema);
    } else {
      // Handle nullable flag (OpenAPI 3.0)
      const baseType = this.getBaseTypeString(schema);
      if (schema.nullable === true) {
        result = `(${baseType} | null)`;
      } else {
        result = baseType;
      }
    }

    // Cache the result if we have a key
    if (schemaKey) {
      this.ctx.typeStringCache.set(schemaKey, result);
    }

    return result;
  }

  /**
   * Creates a cache key for a schema, avoiding circular references
   */
  private getSchemaCacheKey(schema: any, visited: Set<any> = new Set()): string | null {
    if (!schema || typeof schema !== 'object') return null;
    
    // Don't create keys for circular references
    if (visited.has(schema)) return null;
    visited.add(schema);

    // For simple schemas, create a deterministic key
    const parts: string[] = [];
    
    if (schema.type) parts.push(`type:${schema.type}`);
    if (schema.enum) parts.push(`enum:${JSON.stringify(schema.enum)}`);
    if (schema.const !== undefined) parts.push(`const:${JSON.stringify(schema.const)}`);
    if (schema.nullable !== undefined) parts.push(`nullable:${schema.nullable}`);
    if (schema.format) parts.push(`format:${schema.format}`);
    
    // For objects with properties, include property names but not full traversal
    if (schema.properties && typeof schema.properties === 'object') {
      const propKeys = Object.keys(schema.properties).sort().join(',');
      parts.push(`props:${propKeys}`);
      if (schema.required) {
        parts.push(`required:${JSON.stringify(schema.required.sort())}`);
      }
    }
    
    // For arrays, include items type hint
    if (schema.type === 'array' && schema.items) {
      // Only include a hint, not full traversal to avoid circular refs
      if (schema.items.$ref) {
        parts.push(`items:${schema.items.$ref}`);
      } else if (schema.items.type) {
        parts.push(`items:${schema.items.type}`);
      }
    }

    visited.delete(schema);
    
    if (parts.length === 0) return null;
    return parts.join('|');
  }

  getBaseTypeString(schema: any): string {
    switch (schema.type) {
      case 'string':
        return schema.enum
          ? schema.enum.map((v: any) => JSON.stringify(v)).join(' | ')
          : 'string';
      case 'number':
      case 'integer':
        return schema.enum
          ? schema.enum.map((v: any) => v.toString()).join(' | ')
          : 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return `Array<${schema.items ? this.getTypeString(schema.items) : 'unknown'}>`;
      case 'object':
        if (schema.properties) {
          // Inline object type
          const required = schema.required || [];
          const requiredSet = new Set(required);
          const props = Object.entries(schema.properties || {}).map(([key, prop]: [string, any]) => {
            const optional = !requiredSet.has(key);
            const propType = this.getTypeString(prop);
            return `${this.ctx.naming.toPropertyName(key)}${optional ? '?' : ''}: ${propType}`;
          });
          return `{ ${props.join('; ')} }`;
        }
        if (schema.additionalProperties) {
          if (schema.additionalProperties === true) {
            return 'Record<string, unknown>';
          }
          return `Record<string, ${this.getTypeString(schema.additionalProperties)}>`;
        }
        return 'Record<string, unknown>';
      default:
        return 'unknown';
    }
  }

  getPrimitiveType(type: string, schema: any): string {
    switch (type) {
      case 'string':
        return schema.enum
          ? schema.enum.map((v: any) => JSON.stringify(v)).join(' | ')
          : 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return `Array<${schema.items ? this.getTypeString(schema.items) : 'unknown'}>`;
      case 'object':
        return 'Record<string, unknown>';
      default:
        return 'unknown';
    }
  }

  generateDiscriminatedUnion(schema: any, types: string[]): string {
    const discriminator = schema.discriminator;
    if (!discriminator || !discriminator.propertyName) {
      return types.join(' | ');
    }

    // If discriminator has mapping, use mapped types
    if (discriminator.mapping) {
      const mappedTypes = Object.entries(discriminator.mapping).map(([key, value]: [string, any]) => {
        let typeName: string;
        if (typeof value === 'string' && value.startsWith('#/')) {
          // Reference to component
          const refName = value.split('/').pop();
          typeName = this.ctx.naming.toTypeName(refName || '');
        } else {
          typeName = this.ctx.naming.toTypeName(key);
        }
        return `(${typeName} & { ${discriminator.propertyName}: "${key}" })`;
      });
      return mappedTypes.join(' | ');
    }

    return types.join(' | ');
  }

  handleConst(schema: any): string {
    if (schema.const !== undefined) {
      if (typeof schema.const === 'string') {
        return `"${schema.const}"`;
      }
      return JSON.stringify(schema.const);
    }
    return 'unknown';
  }

  getTypeStringWithNestedJSDoc(schema: any, visited: Set<any> = new Set(), generateInlineObjectTypeWithJSDoc: (schema: any, visited?: Set<any>) => string): string {
    if (!schema) return 'unknown';

    // If it's a reference, use the referenced type name
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return this.ctx.naming.toTypeName(refName);
    }

    // For inline object schemas, generate formatted inline type with JSDoc comments
    if ((schema.type === 'object' || schema.properties) && !schema.$ref && !visited.has(schema)) {
      return generateInlineObjectTypeWithJSDoc(schema, visited);
    }

    // For array items that are inline objects
    if (schema.type === 'array' && schema.items) {
      const itemSchema = schema.items;
      if (!itemSchema.$ref && (itemSchema.type === 'object' || itemSchema.properties)) {
        return `Array<${generateInlineObjectTypeWithJSDoc(itemSchema, visited)}>`;
      }
      // Fall back for non-object array items
      return `Array<${this.getTypeStringWithNestedJSDoc(itemSchema, visited, generateInlineObjectTypeWithJSDoc)}>`;
    }

    // Handle composition schemas
    if (schema.anyOf) {
      const types = schema.anyOf.map((s: any) => this.getTypeStringWithNestedJSDoc(s, visited, generateInlineObjectTypeWithJSDoc));
      return `(${types.join(' | ')})`;
    }
    if (schema.oneOf) {
      const types = schema.oneOf.map((s: any) => this.getTypeStringWithNestedJSDoc(s, visited, generateInlineObjectTypeWithJSDoc));
      return `(${types.join(' | ')})`;
    }
    if (schema.allOf) {
      const types = schema.allOf.map((s: any) => this.getTypeStringWithNestedJSDoc(s, visited, generateInlineObjectTypeWithJSDoc));
      return `(${types.join(' & ')})`;
    }

    // Handle nullable flag
    const baseType = this.getBaseTypeString(schema);
    if (schema.nullable === true) {
      return `(${baseType} | null)`;
    }

    // Fall back to regular getTypeString for primitives and other types
    return this.getTypeString(schema);
  }

  generateInlineObjectTypeWithJSDoc(schema: any, visited: Set<any> = new Set(), jsdoc: any): string {
    if (!schema || !schema.properties || visited.has(schema)) {
      return this.getTypeString(schema);
    }
    visited.add(schema);

    const required = schema.required || [];
    const requiredSet = new Set(required);
    const props: string[] = [];

    for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
      const prop = propSchema as any;
      const optional = !requiredSet.has(propName);
      const propType = this.getTypeStringWithNestedJSDoc(prop, visited, (s: any, v?: Set<any>) => this.generateInlineObjectTypeWithJSDoc(s, v, jsdoc));
      
      // Get JSDoc comment for this nested property
      const docComment = jsdoc.generateJSDocComment(prop, propName);
      
      if (docComment) {
        // Format with JSDoc comment (no indentation - ts-morph will add it)
        props.push(`/** ${docComment} */`);
      }
      
      // Format property (no indentation - ts-morph will add it)
      props.push(`${this.ctx.naming.toPropertyName(propName)}${optional ? '?' : ''}: ${propType};`);
    }

    visited.delete(schema);
    // Format properties with 2 spaces indentation
    const formattedProps = props.map(prop => `  ${prop}`);
    return `{\n${formattedProps.join('\n')}\n}`;
  }
}

