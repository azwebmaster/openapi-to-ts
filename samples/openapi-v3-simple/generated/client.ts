import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import type { CreateUserRequest, UpdateUserRequest, User } from "./types.js";

/**
 * Simple API
 *
 * A simple OpenAPI v3 specification for basic testing
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
     * @returns Promise with response data - List of users
     */
    public async getUsers(params?: GetUsersParams, config?: AxiosRequestConfig): Promise<AxiosResponse<Array<User>>> {
        const queryParams = { limit: params?.limit };
        return this.client.get(`/users`, { params: queryParams, ...config });
    }

    /**
     * Create a new user
     *
     * @operationId createUser
     *
     * @param data Request body
     * @param config Optional axios request configuration
     * @returns Promise with response data - User created
     */
    public async createUser(data: CreateUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.post(`/users`, data, config);
    }

    /**
     * Get user by ID
     *
     * @operationId getUserById
     *
     * @param params Parameters object containing path parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - User found
     */
    public async getUserById(params: GetUserByIdParams, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.get(`/users/${params.id}`, config);
    }

    /**
     * Update user
     *
     * @operationId updateUser
     *
     * @param params Parameters object containing path parameters
     * @param data Request body
     * @param config Optional axios request configuration
     * @returns Promise with response data - User updated
     */
    public async updateUser(params: UpdateUserParams, data: UpdateUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.put(`/users/${params.id}`, data, config);
    }

    /**
     * Delete user
     *
     * @operationId deleteUser
     *
     * @param params Parameters object containing path parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - User deleted
     */
    public async deleteUser(params: DeleteUserParams, config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.delete(`/users/${params.id}`, config);
    }
}

export interface GetUsersParams {
    /** Query parameter */
    limit?: number;
}

export interface GetUserByIdParams {
    /** Path parameter */
    id: string;
}

export interface UpdateUserParams {
    /** Path parameter */
    id: string;
}

export interface DeleteUserParams {
    /** Path parameter */
    id: string;
}
