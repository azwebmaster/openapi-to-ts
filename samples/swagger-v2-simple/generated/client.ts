import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import type { User } from "./types.js";

/**
 * Swagger 2.0 Test API
 *
 * Test API using OpenAPI 2.0 (Swagger) format with definitions
 */
export class APIClient {
    private readonly client: AxiosInstance;

    constructor(baseURL: string, config?: AxiosRequestConfig) {
        this.client = axios.create({ baseURL, ...config });
    }

    /**
     * Get all users
     *
     * @operationId getUsers
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Successful response
     */
    public async getUsers(params?: GetUsersParams, config?: AxiosRequestConfig): Promise<AxiosResponse<Array<User>>> {
        const queryParams = { page: params?.page, limit: params?.limit };
        return this.client.get(`/users`, { params: queryParams, ...config });
    }
}

export interface GetUsersParams {
    /** Query parameter */
    page?: number;
    /** Query parameter */
    limit?: number;
}
