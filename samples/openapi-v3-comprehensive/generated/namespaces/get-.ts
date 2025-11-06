import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import type { HealthStatus, ServiceHealth } from "../types.js";

/** get_ namespace operations */
export interface GetOperations {
    /** Health check */
    getHealth(config?: AxiosRequestConfig): Promise<AxiosResponse<HealthStatus>>;
}

export class GetNamespace {
    private readonly client: AxiosInstance;

    constructor(client: AxiosInstance) {
        this.client = client;
    }

    /**
     * Health check
     *
     * Check API health status
     *
     * @operationId get_/health
     *
     * @returns API is healthy
     */
    public async getHealth(config?: AxiosRequestConfig): Promise<AxiosResponse<HealthStatus>> {
        return this.client.get(`/health`, config);
    }
}

export const createGetNamespace = (client: AxiosInstance) => new GetNamespace(client);
