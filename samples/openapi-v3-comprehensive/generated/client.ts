import { AxiosInstance, AxiosRequestConfig } from "axios";
import axios from "axios";
import { ApiOperations, createApiNamespace } from "./namespaces/api.js";
import { GetOperations, createGetNamespace } from "./namespaces/get-.js";
import { GetSpecialCharsOperations, createGetSpecialCharsNamespace } from "./namespaces/get-special-chars.js";
import { NamespaceOperations, createNamespaceNamespace } from "./namespaces/namespace.js";

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
export class ComprehensiveAPIClient {
    private readonly client: AxiosInstance;
    /** Access to the internal AxiosInstance for advanced usage */
    public readonly axios: AxiosInstance;

    constructor(baseURL: string, config?: AxiosRequestConfig) {
        this.client = axios.create({ baseURL, ...config });
        this.axios = this.client;
        this.api = createApiNamespace(this.client);
        this.get = createGetNamespace(this.client);
        this.getSpecialChars = createGetSpecialCharsNamespace(this.client);
        this.namespace = createNamespaceNamespace(this.client);
    }

    /**
     * Get all users
     *
     * Retrieve a paginated list of users
     *
     * @operationId getUsers
     *
     * @returns Successful response
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
     * @operationId createUser
     *
     * @returns User created successfully
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
     * @returns User found
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
     * @returns User updated successfully
     */
    public async updateUser(data: UpdateUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.put(`/users/{userId}`, data, config);
    }

    /**
     * Partially update user
     *
     * Partially update an existing user
     *
     * @operationId patchUser
     *
     * @returns User updated successfully
     */
    public async patchUser(data: PatchUserRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<User>> {
        return this.client.patch(`/users/{userId}`, data, config);
    }

    /**
     * Delete user
     *
     * Delete an existing user
     *
     * @operationId deleteUser
     *
     * @returns User deleted successfully
     */
    public async deleteUser(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.delete(`/users/{userId}`, config);
    }

    /**
     * Search content
     *
     * Search across multiple content types with complex filtering
     *
     * @operationId searchContent
     *
     * @returns Search results
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
     * @operationId uploadFile
     *
     * @returns File uploaded successfully
     */
    public async uploadFile(data: UploadFileData, config?: AxiosRequestConfig): Promise<AxiosResponse<FileInfo>> {
        return this.client.post(`/upload`, data, config);
    }

    /**
     * Upload multiple files
     *
     * Upload multiple files in one request
     *
     * @operationId uploadMultipleFiles
     *
     * @returns Files uploaded successfully
     */
    public async uploadMultipleFiles(data: UploadMultipleFilesData, config?: AxiosRequestConfig): Promise<AxiosResponse<Array<FileInfo>>> {
        return this.client.post(`/upload/multiple`, data, config);
    }

    /**
     * Export data
     *
     * Export data in various formats
     *
     * @operationId exportData
     *
     * @returns Data export
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
     * @operationId getWebhooks
     *
     * @returns List of webhooks
     */
    public async getWebhooks(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Webhook>>> {
        return this.client.get(`/webhooks`, config);
    }

    /**
     * Create webhook
     *
     * Create a new webhook
     *
     * @operationId createWebhook
     *
     * @returns Webhook created
     */
    public async createWebhook(data: CreateWebhookRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<Webhook>> {
        return this.client.post(`/webhooks`, data, config);
    }

    /**
     * Numbers in operationId
     *
     * Test operationId with numbers mixed in
     *
     * @operationId get123Numbers456
     *
     * @returns Success
     */
    public async get123Numbers456(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.get(`/numbers123`, config);
    }

    /**
     * Get notifications
     *
     * Get user notifications of various types
     *
     * @operationId getNotifications
     *
     * @returns List of notifications
     */
    public async getNotifications(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<unknown>>> {
        return this.client.get(`/notifications`, config);
    }

    /**
     * Get categories
     *
     * Get category tree with subcategories
     *
     * @operationId getCategories
     *
     * @returns Category tree
     */
    public async getCategories(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Category>>> {
        return this.client.get(`/categories`, config);
    }

    /**
     * Create or log an event
     *
     * Create a new event with optional metadata in the request body
     *
     * @operationId createEvent
     *
     * @returns Event created successfully
     */
    public async createEvent(params?: CreateEventParams, data?: EventMetadata, config?: AxiosRequestConfig): Promise<AxiosResponse<Event>> {
        const queryParams = { source: params?.source };
        return this.client.post(`/events`, data, { params: queryParams, ...config });
    }

    /**
     * Delete events
     *
     * Delete events with optional filtering parameter and optional body
     *
     * @operationId deleteEvents
     *
     * @returns Events deleted successfully
     */
    public async deleteEvents(params?: DeleteEventsParams, data?: DeleteEventsRequest, config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        const queryParams = { filter: params?.filter };
        return this.client.delete(`/events`, { params: queryParams, data: data, ...config });
    }

    /**
     * Get analytics report
     *
     * Generate analytics report with complex filtering
     *
     * @operationId getAnalyticsReport
     *
     * @returns Analytics report
     */
    public async getAnalyticsReport(params: GetAnalyticsReportParams, config?: AxiosRequestConfig): Promise<AxiosResponse<AnalyticsReport>> {
        const queryParams = { metrics: params.metrics, dimensions: params?.dimensions, filters: params?.filters, period: params.period };
        return this.client.get(`/analytics/reports`, { params: queryParams, ...config });
    }

    /** api namespace operations */
    public readonly api: ApiOperations;
    /** get_ namespace operations */
    public readonly get: GetOperations;
    /** get-special_chars namespace operations */
    public readonly getSpecialChars: GetSpecialCharsOperations;
    /** namespace namespace operations */
    public readonly namespace: NamespaceOperations;
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
    tags?: Array<"users" | "posts" | "comments" | "products">;
    /** Search context (query parameter) */
    context?: "web" | "mobile" | "api";
}

/**
 * UploadFileData property
 * Type: object
 */
export interface UploadFileData {
    /**
     * file property
     * Type: string, Format: binary
     */
    file: string;
    /**
     * description property
     * Type: string, Max length: 500
     */
    description?: string;
    /**
     * tags property
     * Type: array
     */
    tags?: Array<string>;
}

/**
 * UploadMultipleFilesData property
 * Type: object
 */
export interface UploadMultipleFilesData {
    /**
     * files property
     * Type: array, Max items: 10
     */
    files: Array<string>;
    /**
     * metadata property
     * Type: string, Format: json
     */
    metadata?: string;
}

export interface ExportDataParams {
    /** Query parameter */
    format: "json" | "csv" | "xml" | "pdf";
    /** Query parameter */
    include_metadata?: boolean;
}

export interface CreateEventParams {
    /** Event source (query parameter) */
    source?: "web" | "mobile" | "api";
}

export interface DeleteEventsParams {
    /** Filter which events to delete (optional - if not provided, deletes all events) (query parameter) */
    filter?: "all" | "old" | "recent";
}

export interface GetAnalyticsReportParams {
    /** Query parameter */
    metrics: Array<"users" | "posts" | "comments" | "products">;
    /** Query parameter */
    dimensions?: Array<"users" | "posts" | "comments" | "products">;
    /** Query parameter */
    filters?: Record<string, unknown>;
    /** Query parameter */
    period: DateRange;
}
