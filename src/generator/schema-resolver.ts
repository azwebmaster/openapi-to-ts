/**
 * Schema resolution and caching utilities
 */

import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import type { SchemaReference, ParameterReference, AllSchemas } from './types-internal.js';

export class SchemaResolver {
  private schemaRefCache = new Map<string, SchemaReference>();
  private parameterRefCache = new Map<string, ParameterReference>();

  /**
   * Resolves a schema reference
   */
  resolveSchemaReference(
    ref: string,
    allSchemas: AllSchemas
  ): OpenAPIV3.SchemaObject | null {
    if (!ref || !ref.startsWith('#')) {
      return null;
    }

    // Check cache first
    if (this.schemaRefCache.has(ref)) {
      const cached = this.schemaRefCache.get(ref);
      return cached && !('$ref' in cached) ? cached : null;
    }

    let result: OpenAPIV3.SchemaObject | null = null;

    // Handle OpenAPI 3.x references: #/components/schemas/SchemaName
    if (ref.startsWith('#/components/schemas/')) {
      const schemaName = ref.split('/').pop();
      result = schemaName ? allSchemas[schemaName] || null : null;
    }
    // Handle OpenAPI 2.0 references: #/definitions/SchemaName
    else if (ref.startsWith('#/definitions/')) {
      const schemaName = ref.split('/').pop();
      result = schemaName ? allSchemas[schemaName] || null : null;
    }

    // Cache the result
    if (result !== null) {
      this.schemaRefCache.set(ref, result);
    }

    return result;
  }

  /**
   * Resolves a parameter reference
   */
  resolveParameterReference(
    ref: string,
    api: OpenAPIV3.Document | OpenAPIV3_1.Document
  ): OpenAPIV3.ParameterObject | null {
    if (!ref || !ref.startsWith('#')) {
      return null;
    }

    // Check cache first
    if (this.parameterRefCache.has(ref)) {
      const cached = this.parameterRefCache.get(ref);
      return cached && !('$ref' in cached) ? cached : null;
    }

    let result: OpenAPIV3.ParameterObject | null = null;

    // Handle OpenAPI 3.x references: #/components/parameters/ParameterName
    if (ref.startsWith('#/components/parameters/')) {
      const paramName = ref.split('/').pop();
      const allParameters = (api.components as OpenAPIV3.ComponentsObject)?.parameters || {};
      result = paramName ? (allParameters[paramName] as OpenAPIV3.ParameterObject) || null : null;
    }
    // Handle OpenAPI 2.0 references: #/parameters/ParameterName
    else if (ref.startsWith('#/parameters/')) {
      const paramName = ref.split('/').pop();
      const allParameters = (api as any)?.parameters || {};
      result = paramName ? allParameters[paramName] || null : null;
    }

    // Cache the result
    if (result !== null) {
      this.parameterRefCache.set(ref, result);
    }

    return result;
  }

  /**
   * Gets all schemas from an OpenAPI document (supports both v3 and v2)
   */
  getAllSchemas(api: OpenAPIV3.Document | OpenAPIV3_1.Document | null): AllSchemas {
    if (!api) return {};
    
    return (
      (api.components as OpenAPIV3.ComponentsObject)?.schemas ||
      (api as OpenAPIV3_1.Document)?.components?.schemas ||
      (api as any)?.definitions ||
      {}
    );
  }

  /**
   * Clears all caches
   */
  clearCaches(): void {
    this.schemaRefCache.clear();
    this.parameterRefCache.clear();
  }
}

