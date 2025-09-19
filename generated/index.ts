import type { AxiosRequestConfig } from "axios";
import { OpenAPI3Client } from "./client.js";

export * from "./types.js";
export { OpenAPI3Client } from "./client.js";

export const createClient = (baseURL: string, config?: AxiosRequestConfig) => new OpenAPI3Client(baseURL, config);
