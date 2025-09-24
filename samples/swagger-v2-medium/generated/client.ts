import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import type { CreateProductRequest, CreateUserRequest, FileInfo, HealthStatus, Pagination, Product, ProductListResponse, SearchResult, SearchResults, UpdateUserRequest, User, UserListResponse, UserPreferences } from "./types.js";

/**
 * Medium Complexity Swagger API
 *
 * A medium complexity Swagger 2.0 specification with authentication, file uploads, and complex schemas
 */
export class APIClient {
    private readonly client: AxiosInstance;

    constructor(baseURL: string, config?: AxiosRequestConfig) {
        this.client = axios.create({ baseURL, ...config });
    }

    /**
     * Get all users
     *
     * Retrieve a paginated list of users with filtering
     *
     * @operationId getUsers
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Successful response
     */
    public async getUsers(params?: GetUsersParams, config?: AxiosRequestConfig): Promise<AxiosResponse<UserListResponse>> {
        const queryParams = { page: params?.page, limit: params?.limit, search: params?.search, role: params?.role };
        return this.client.get(`/users`, { params: queryParams, ...config });
    }

    /**
     * Create a new user
     *
     * Create a new user account with validation
     *
     * @operationId createUser
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - User created successfully
     */
    public async createUser(data: CreateUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.post(`/users`, data, config);
    }

    /**
     * Get user by ID
     *
     * Retrieve a specific user by their ID
     *
     * @operationId getUserById
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - User found
     */
    public async getUserById(config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.get(`/users/{userId}`, config);
    }

    /**
     * Update user
     *
     * Update an existing user (full update)
     *
     * @operationId updateUser
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - User updated successfully
     */
    public async updateUser(data: UpdateUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.put(`/users/{userId}`, data, config);
    }

    /**
     * Delete user
     *
     * Delete an existing user
     *
     * @operationId deleteUser
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - User deleted successfully
     */
    public async deleteUser(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.delete(`/users/{userId}`, config);
    }

    /**
     * Upload user avatar
     *
     * Upload an avatar image for a user
     *
     * @operationId uploadUserAvatar
     *
     * @param params Parameters object containing path parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Avatar uploaded successfully
     */
    public async uploadUserAvatar(params: UploadUserAvatarParams, config?: AxiosRequestConfig): Promise<AxiosResponse<FileInfo>> {
        return this.client.post(`/users/${params.userId}/avatar`, undefined, config);
    }

    /**
     * Get products
     *
     * Get a list of products with filtering and sorting
     *
     * @operationId getProducts
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - List of products
     */
    public async getProducts(params?: GetProductsParams, config?: AxiosRequestConfig): Promise<AxiosResponse<ProductListResponse>> {
        const queryParams = { category: params?.category, minPrice: params?.minPrice, maxPrice: params?.maxPrice, inStock: params?.inStock, sortBy: params?.sortBy, sortOrder: params?.sortOrder };
        return this.client.get(`/products`, { params: queryParams, ...config });
    }

    /**
     * Create a new product
     *
     * Create a new product with validation
     *
     * @operationId createProduct
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - Product created successfully
     */
    public async createProduct(data: CreateProductRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<Product>> {
        return this.client.post(`/products`, data, config);
    }

    /**
     * Get product by ID
     *
     * Retrieve a specific product by its ID
     *
     * @operationId getProductById
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - Product found
     */
    public async getProductById(config?: AxiosRequestConfig): Promise<AxiosResponse<Product>> {
        return this.client.get(`/products/{productId}`, config);
    }

    /**
     * Search content
     *
     * Search across users and products
     *
     * @operationId searchContent
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Search results
     */
    public async searchContent(params: SearchContentParams, config?: AxiosRequestConfig): Promise<AxiosResponse<SearchResults>> {
        const queryParams = { q: params.q, type: params?.type, limit: params?.limit };
        return this.client.get(`/search`, { params: queryParams, ...config });
    }

    /**
     * Health check
     *
     * Check API health status
     *
     * @operationId healthCheck
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - API is healthy
     */
    public async healthCheck(config?: AxiosRequestConfig): Promise<AxiosResponse<HealthStatus>> {
        return this.client.get(`/health`, config);
    }
}

export interface GetUsersParams {
    /** Query parameter */
    page?: number;
    /** Query parameter */
    limit?: number;
    /** Search by name or email (query parameter) */
    search?: string;
    /** Query parameter */
    role?: "admin" | "user" | "guest";
}

export interface UploadUserAvatarParams {
    /** Path parameter */
    userId: string;
    /** Avatar image file */
    file: unknown;
    /** Optional description of the avatar */
    description?: string;
}

export interface GetProductsParams {
    /** Query parameter */
    category?: "electronics" | "clothing" | "books" | "home";
    /** Query parameter */
    minPrice?: number;
    /** Query parameter */
    maxPrice?: number;
    /** Query parameter */
    inStock?: boolean;
    /** Query parameter */
    sortBy?: "name" | "price" | "createdAt";
    /** Query parameter */
    sortOrder?: "asc" | "desc";
}

export interface SearchContentParams {
    /** Search query (query parameter) */
    q: string;
    /** Query parameter */
    type?: Array<"users" | "products">;
    /** Query parameter */
    limit?: number;
}
