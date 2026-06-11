/**
 * Internal type definitions for the generator
 */

import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

/**
 * Resolved parameter with all references resolved
 */
export interface ResolvedParameter extends OpenAPIV3.ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body';
  required?: boolean;
  schema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
}

/**
 * Operation metadata for performance optimization
 */
export interface OperationMetadata {
  baseMethodName: string;
  methodName: string;
  namespace: string;
  separator: string | null;
  rootNamespace: string | null;
  resolvedParameters: ResolvedParameter[];
  bodyParams: ResolvedParameter[];
  requestBodySchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | null;
  requestBodyContentType: string | null;
  parts: string[];
}

/**
 * Operation with metadata
 */
export interface OperationWithMetadata {
  path: string;
  method: string;
  operation: OpenAPIV3.OperationObject;
  operationId: string;
  metadata?: OperationMetadata;
}

/**
 * Schema reference cache entry
 */
export type SchemaReference = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

/**
 * Parameter reference cache entry
 */
export type ParameterReference = OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject;

/**
 * Response type cache key
 */
export interface ResponseTypeCacheKey {
  responses: string;
  methodName?: string;
}

/**
 * Namespace tree node
 */
export interface NamespaceTreeNode {
  _methods?: Array<{
    name: string;
    privateMethod: string;
    operation: OperationWithMetadata;
  }>;
  [key: string]: NamespaceTreeNode | Array<any> | undefined;
}

/**
 * Schema groups for type organization
 */
export type SchemaGroups = Record<string, Record<string, OpenAPIV3.SchemaObject>>;

/**
 * All schemas from OpenAPI document (supports both v3 and v2)
 */
export type AllSchemas = Record<string, OpenAPIV3.SchemaObject>;

