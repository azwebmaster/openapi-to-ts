import type { AxiosRequestConfig } from "axios";
import { APIClient } from "./client.js";

export * from "./types.js";
export { APIClient } from "./client.js";

export const createClient = (baseURL: string, config?: AxiosRequestConfig) => new APIClient(baseURL, config);
