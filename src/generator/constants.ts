/**
 * Constants used throughout the generator
 */

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

export type HttpMethod = typeof HTTP_METHODS[number];

export const FETCH_TIMEOUT_MS = 30000;

export const USER_AGENT = 'openapi-generator-cli';

export const FILE_EXTENSIONS = {
  typescript: '.ts',
  javascript: '.js',
} as const;

export const SUCCESS_CODES = ['200', '201', '202', '204', '206'] as const;

export const DEFAULT_NAMESPACE = 'API';

export const DEFAULT_OUTPUT_DIR = './generated';

export const DEFAULT_TYPE_OUTPUT_MODE = 'single-file' as const;

export const DEFAULT_CLIENT_OUTPUT_MODE = 'split-by-namespace' as const;

