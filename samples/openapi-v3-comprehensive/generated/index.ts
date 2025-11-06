import type { AxiosRequestConfig } from "axios";
import { ComprehensiveAPIClient } from "./client.js";

export * from "./types.js";
export { ComprehensiveAPIClient } from "./client.js";

export const createClient = (baseURL: string, config?: AxiosRequestConfig) => new ComprehensiveAPIClient(baseURL, config);
