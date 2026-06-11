/**
 * Validation utilities for the generator
 */

import { OpenAPIDocument } from '../types.js';
import { OpenAPIV3 } from 'openapi-types';

/**
 * Asserts that the API document is loaded
 */
export function assertApiLoaded(api: OpenAPIDocument | null): asserts api is OpenAPIDocument {
  if (!api) {
    throw new Error('API document not loaded. Call generate() first.');
  }
}

/**
 * Asserts that the API document has paths
 */
export function assertApiHasPaths(api: OpenAPIDocument | null): asserts api is OpenAPIDocument & { paths: OpenAPIV3.PathsObject } {
  if (!api || !api.paths) {
    throw new Error('API document has no paths defined.');
  }
}

/**
 * Validates that a schema is not a reference (is an inline schema)
 */
export function isInlineSchema(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): schema is OpenAPIV3.SchemaObject {
  return !('$ref' in schema);
}

