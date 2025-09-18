import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import type { AnalyticsReport, Category, CreateUserRequest, CreateWebhookRequest, DateRange, EmailNotification, Error, ExportData, FileInfo, HealthStatus, Pagination, PatchUserRequest, PushNotification, SMSNotification, SearchResults, UpdateUserRequest, User, Webhook } from "./types.js";

/**
 * Comprehensive Test API
 *
 * A comprehensive OpenAPI specification covering all possible test scenarios
 * for openapi-to-ts generator testing including:
 * - All HTTP methods
 * - Complex data types and schemas
 * - Authentication mechanisms
 * - Parameter types and locations
 * - Response variations
 * - Edge cases and special scenarios
 *
 */
export class APIClient {
    private readonly client: AxiosInstance;

    constructor(baseURL: string, config?: AxiosRequestConfig) {
        this.client = axios.create({ baseURL, ...config });
        this.get_ = {
              getHealth: this.get__getHealth.bind(this)
            };
        this.api = {
              v1: {
                v1GetResources: this.api_v1_v1GetResources.bind(this)
              }
            };
        this.namespace = {
              action: {
                actionCreate: this.namespace_action_actionCreate.bind(this)
              }
            };
    }

    /**
     * Get all users
     *
     * Retrieve a paginated list of users
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Successful response
     */
    public async getUsers(params?: GetUsersParams, config?: AxiosRequestConfig): Promise<AxiosResponse<{ data?: Array<User>; pagination?: Pagination; meta?: { total?: number; filtered?: number } }>> {
        const queryParams = { page: params?.page, limit: params?.limit, sort: params?.sort, order: params?.order, filter: params?.filter };
        return this.client.get(`/users`, { params: queryParams, ...config });
    }

    /**
     * Create a new user
     *
     * Create a new user account
     *
     * @param data Request body
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
     * @param data Request body
     * @param config Optional axios request configuration
     * @returns Promise with response data - User updated successfully
     */
    public async updateUser(data: UpdateUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.put(`/users/{userId}`, data, config);
    }

    /**
     * Partially update user
     *
     * Partially update an existing user
     *
     * @param data Request body
     * @param config Optional axios request configuration
     * @returns Promise with response data - User updated successfully
     */
    public async patchUser(data: PatchUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.patch(`/users/{userId}`, data, config);
    }

    /**
     * Delete user
     *
     * Delete an existing user
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - User deleted successfully
     */
    public async deleteUser(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.delete(`/users/{userId}`, config);
    }

    /**
     * Search content
     *
     * Search across multiple content types with complex filtering
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Search results
     */
    public async searchContent(params: SearchContentParams, config?: AxiosRequestConfig): Promise<AxiosResponse<SearchResults>> {
        const queryParams = { q: params.q, type: params?.type, date_from: params?.date_from, date_to: params?.date_to, tags: params?.tags, context: params?.context };
        return this.client.get(`/search`, { params: queryParams, ...config });
    }

    /**
     * Upload file
     *
     * Upload a single file
     *
     * @param data Request body
     * @param config Optional axios request configuration
     * @returns Promise with response data - File uploaded successfully
     */
    public async uploadFile(data: { file: string; description?: string; tags?: Array<string> }, config?: AxiosRequestConfig): Promise<AxiosResponse<FileInfo>> {
        return this.client.post(`/upload`, data, config);
    }

    /**
     * Upload multiple files
     *
     * Upload multiple files in one request
     *
     * @param data Request body
     * @param config Optional axios request configuration
     * @returns Promise with response data - Files uploaded successfully
     */
    public async uploadMultipleFiles(data: { files: Array<string>; metadata?: string }, config?: AxiosRequestConfig): Promise<AxiosResponse<Array<FileInfo>>> {
        return this.client.post(`/upload/multiple`, data, config);
    }

    /**
     * Export data
     *
     * Export data in various formats
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Data export
     */
    public async exportData(params: ExportDataParams, config?: AxiosRequestConfig): Promise<AxiosResponse<ExportData>> {
        const queryParams = { format: params.format, include_metadata: params?.include_metadata };
        return this.client.get(`/data/export`, { params: queryParams, ...config });
    }

    /**
     * Get webhooks
     *
     * Get all configured webhooks
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - List of webhooks
     */
    public async getWebhooks(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Webhook>>> {
        return this.client.get(`/webhooks`, config);
    }

    /**
     * Create webhook
     *
     * Create a new webhook
     *
     * @param data Request body
     * @param config Optional axios request configuration
     * @returns Promise with response data - Webhook created
     */
    public async createWebhook(data: CreateWebhookRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<Webhook>> {
        return this.client.post(`/webhooks`, data, config);
    }

    /**
     * Special characters in operationId
     *
     * Test operationId with hyphens, underscores, and dots
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - Success
     */
    public async getSpecialCharsEndpoint(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.get(`/special-chars`, config);
    }

    /**
     * Numbers in operationId
     *
     * Test operationId with numbers mixed in
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - Success
     */
    public async get123Numbers456(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.get(`/numbers123`, config);
    }

    /**
     * Get notifications
     *
     * Get user notifications of various types
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - List of notifications
     */
    public async getNotifications(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<(EmailNotification & { type: "email" }) | (PushNotification & { type: "push" }) | (SMSNotification & { type: "sms" })>>> {
        return this.client.get(`/notifications`, config);
    }

    /**
     * Get categories
     *
     * Get category tree with subcategories
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - Category tree
     */
    public async getCategories(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Category>>> {
        return this.client.get(`/categories`, config);
    }

    /**
     * Get analytics report
     *
     * Generate analytics report with complex filtering
     *
     * @param params Parameters object containing query parameters
     * @param config Optional axios request configuration
     * @returns Promise with response data - Analytics report
     */
    public async getAnalyticsReport(params: GetAnalyticsReportParams, config?: AxiosRequestConfig): Promise<AxiosResponse<AnalyticsReport>> {
        const queryParams = { metrics: params.metrics, dimensions: params?.dimensions, filters: params?.filters, period: params.period };
        return this.client.get(`/analytics/reports`, { params: queryParams, ...config });
    }

    /** get_ namespace operations */
    public readonly get_: Get_Operations;

    /**
     * Health check
     *
     * Check API health status
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - API is healthy
     */
    private async get__getHealth(config?: AxiosRequestConfig): Promise<AxiosResponse<HealthStatus>> {
        return this.client.get(`/health`, config);
    }

    /** api namespace operations */
    public readonly api: ApiOperations;

    /**
     * Get resources with slash in operationId
     *
     * Test operationId containing forward slashes
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - Resources list
     */
    private async api_v1_v1GetResources(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Record<string, unknown>>>> {
        return this.client.get(`/api/v1/resources`, config);
    }

    /** namespace namespace operations */
    public readonly namespace: NamespaceOperations;

    /**
     * Namespaced action
     *
     * Test deeply nested operationId with multiple slashes
     *
     * @param config Optional axios request configuration
     * @returns Promise with response data - Action created
     */
    private async namespace_action_actionCreate(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.post(`/namespaced/action`, undefined, config);
    }
}

export interface GetUsersParams {
    /** Query parameter */
    page?: number;
    /** Query parameter */
    limit?: number;
    /** Query parameter */
    sort?: "name" | "email" | "created_at";
    /** Query parameter */
    order?: "asc" | "desc";
    /** Filter users by name or email (query parameter) */
    filter?: string;
}

export interface SearchContentParams {
    /** Search query (query parameter) */
    q: string;
    /** Query parameter */
    type?: Array<"users" | "posts" | "comments" | "products">;
    /** Query parameter */
    date_from?: string;
    /** Query parameter */
    date_to?: string;
    /** Query parameter */
    tags?: Array<string>;
    /** Search context (query parameter) */
    context?: "web" | "mobile" | "api";
}

export interface ExportDataParams {
    /** Query parameter */
    format: "json" | "csv" | "xml" | "pdf";
    /** Query parameter */
    include_metadata?: boolean;
}

export interface GetAnalyticsReportParams {
    /** Query parameter */
    metrics: Array<"views" | "clicks" | "conversions" | "revenue">;
    /** Query parameter */
    dimensions?: Array<"date" | "country" | "device" | "source">;
    /** Query parameter */
    filters?: Record<string, (string | Array<string>)>;
    /** Query parameter */
    period: DateRange;
}

/** get_ namespace operations */
export interface Get_Operations {
    /** Health check */
    getHealth(config?: AxiosRequestConfig): Promise<AxiosResponse<HealthStatus>>;
}

/** api namespace operations */
export interface ApiOperations {
    /** v1 sub-namespace */
    readonly v1: ApiV1Operations;
}

/** api/v1 namespace operations */
export interface ApiV1Operations {
    /** Get resources with slash in operationId */
    v1GetResources(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Record<string, unknown>>>>;
}

/** namespace namespace operations */
export interface NamespaceOperations {
    /** action sub-namespace */
    readonly action: NamespaceActionOperations;
}

/** namespace/action namespace operations */
export interface NamespaceActionOperations {
    /** Namespaced action */
    actionCreate(config?: AxiosRequestConfig): Promise<AxiosResponse<void>>;
}
