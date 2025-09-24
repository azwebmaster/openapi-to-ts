import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import type { ErrorResponse, Product, User } from "./types.js";

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
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Successful response
     */
    public async getUsers(params?: GetUsersParams, config?: AxiosRequestConfig): Promise<AxiosResponse<Array<User>>> {
        const queryParams = { page: params?.page, limit: params?.limit };
        return this.client.get(`/users`, { params: queryParams, ...config });
    }

    /**
     * Create a new user
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - User created
     */
    public async createUser(data: User, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.post(`/users`, data, config);
    }

    /**
     * Get a product by ID
     *
     * @param params Parameters object containing path parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Product found
     */
    public async getProduct(params: GetProductParams, config?: AxiosRequestConfig): Promise<AxiosResponse<Product>> {
        return this.client.get(`/products/${params.id}`, config);
    }
}

export interface GetUsersParams {
    /** Query parameter */
    page?: number;
    /** Query parameter */
    limit?: number;
}

export interface GetProductParams {
    /** Path parameter */
    id: string;
}
