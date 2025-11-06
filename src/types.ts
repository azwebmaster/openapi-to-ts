import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

export enum TypeOutputMode {
  SingleFile = 'single-file',
  FilePerType = 'file-per-type',
  GroupByTag = 'group-by-tag'
}

export enum ClientOutputMode {
  SingleFile = 'single-file',
  SplitByNamespace = 'split-by-namespace'
}

export interface APIConfig {
  name: string;
  spec: string;
  output?: string;  // matches --output
  namespace?: string;  // matches --namespace
  axiosInstance?: string;  // matches --axios-instance
  typeOutput?: string;  // matches --type-output
  headers?: Record<string, string>;  // matches --header
  operationIds?: string[];
}

export interface OTTConfig {
  apis: APIConfig[];
}

export interface GeneratorOptions {
  spec: string;
  outputDir: string;
  axiosInstanceName?: string;
  namespace?: string;
  headers?: Record<string, string>;
  typeOutputMode?: TypeOutputMode;
  clientOutputMode?: ClientOutputMode;
  operationIds?: string[];
  noProgress?: boolean;
}

export type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document;

/**
 * Resolves environment variables in header values.
 * Supports syntax: ${VAR_NAME} or ${VAR_NAME:default_value}
 * 
 * @param value The header value that may contain environment variable references
 * @returns The resolved value with environment variables substituted
 */
export function resolveEnvironmentVariables(value: string): string {
  return value.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (match, varName, defaultValue) => {
    const envValue = process.env[varName];
    if (envValue !== undefined) {
      return envValue;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // If no environment variable and no default, keep the original placeholder
    // This allows for graceful handling of missing env vars
    return match;
  });
}

/**
 * Resolves environment variables in a headers object.
 * 
 * @param headers The headers object that may contain environment variable references
 * @returns A new headers object with environment variables resolved
 */
export function resolveHeadersEnvironmentVariables(headers: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    resolved[key] = resolveEnvironmentVariables(value);
  }
  return resolved;
}

