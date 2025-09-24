/**
 * User property
 * Type: object
 */
export interface User {
    /**
     * id property
     * Type: string, Format: uuid, Read-only: true
     */
    id: string;
    /**
     * email property
     * Type: string, Format: email
     */
    email: string;
    /**
     * name property
     * Type: string, Min length: 1, Max length: 100
     */
    name: string;
    /**
     * role property
     * Type: string, Allowed values: "admin", "user", "guest"
     */
    role: "admin" | "user" | "guest";
    /**
     * avatar property
     * Type: string, Format: uri
     */
    avatar?: string;
    /** preferences property */
    preferences?: UserPreferences;
    /**
     * createdAt property
     * Type: string, Format: date-time, Read-only: true
     */
    createdAt: string;
    /**
     * updatedAt property
     * Type: string, Format: date-time, Read-only: true
     */
    updatedAt?: string;
}

/**
 * UserPreferences property
 * Type: object
 */
export interface UserPreferences {
    /**
     * theme property
     * Type: string, Default: "auto", Allowed values: "light", "dark", "auto"
     */
    theme?: "light" | "dark" | "auto";
    /**
     * language property
     * Type: string, Default: "en", Pattern: ^[a-z]{2}(-[A-Z]{2})?$
     */
    language?: string;
    /**
     * notifications property
     * Type: object
     */
    notifications?: { email?: boolean; push?: boolean };
}

/**
 * CreateUserRequest property
 * Type: object
 */
export interface CreateUserRequest {
    /**
     * email property
     * Type: string, Format: email
     */
    email: string;
    /**
     * name property
     * Type: string, Min length: 1, Max length: 100
     */
    name: string;
    /**
     * password property
     * Type: string, Format: password, Min length: 8, Max length: 128
     */
    password: string;
    /**
     * role property
     * Type: string, Default: "user", Allowed values: "user", "guest"
     */
    role?: "user" | "guest";
    /** preferences property */
    preferences?: UserPreferences;
}

/**
 * UpdateUserRequest property
 * Type: object
 */
export interface UpdateUserRequest {
    /**
     * name property
     * Type: string, Min length: 1, Max length: 100
     */
    name?: string;
    /**
     * role property
     * Type: string, Allowed values: "admin", "user", "guest"
     */
    role?: "admin" | "user" | "guest";
    /** preferences property */
    preferences?: UserPreferences;
}

/**
 * UserListResponse property
 * Type: object
 */
export interface UserListResponse {
    /**
     * data property
     * Type: array
     */
    data?: Array<User>;
    /** pagination property */
    pagination?: Pagination;
    /**
     * meta property
     * Type: object
     */
    meta?: { total?: number; filtered?: number };
}

/**
 * Product property
 * Type: object
 */
export interface Product {
    /**
     * id property
     * Type: string, Format: uuid, Read-only: true
     */
    id: string;
    /**
     * name property
     * Type: string, Min length: 1, Max length: 200
     */
    name: string;
    /**
     * description property
     * Type: string, Max length: 1000
     */
    description?: string;
    /**
     * price property
     * Type: number, Minimum: 0
     */
    price: number;
    /**
     * category property
     * Type: string, Allowed values: "electronics", "clothing", "books", "home"
     */
    category: "electronics" | "clothing" | "books" | "home";
    /**
     * inStock property
     * Type: boolean
     */
    inStock: boolean;
    /**
     * stockQuantity property
     * Type: integer, Minimum: 0
     */
    stockQuantity?: number;
    /**
     * tags property
     * Type: array, Max items: 10
     */
    tags?: Array<string>;
    /**
     * images property
     * Type: array, Max items: 5
     */
    images?: Array<string>;
    /**
     * createdAt property
     * Type: string, Format: date-time, Read-only: true
     */
    createdAt: string;
    /**
     * updatedAt property
     * Type: string, Format: date-time, Read-only: true
     */
    updatedAt?: string;
}

/**
 * CreateProductRequest property
 * Type: object
 */
export interface CreateProductRequest {
    /**
     * name property
     * Type: string, Min length: 1, Max length: 200
     */
    name: string;
    /**
     * description property
     * Type: string, Max length: 1000
     */
    description?: string;
    /**
     * price property
     * Type: number, Minimum: 0
     */
    price: number;
    /**
     * category property
     * Type: string, Allowed values: "electronics", "clothing", "books", "home"
     */
    category: "electronics" | "clothing" | "books" | "home";
    /**
     * inStock property
     * Type: boolean, Default: true
     */
    inStock?: boolean;
    /**
     * stockQuantity property
     * Type: integer, Default: 0, Minimum: 0
     */
    stockQuantity?: number;
    /**
     * tags property
     * Type: array, Max items: 10
     */
    tags?: Array<string>;
}

/**
 * ProductListResponse property
 * Type: object
 */
export interface ProductListResponse {
    /**
     * data property
     * Type: array
     */
    data?: Array<Product>;
    /** pagination property */
    pagination?: Pagination;
}

/**
 * SearchResults property
 * Type: object
 */
export interface SearchResults {
    /**
     * query property
     * Type: string
     */
    query?: string;
    /**
     * results property
     * Type: array
     */
    results?: Array<SearchResult>;
    /**
     * total property
     * Type: integer
     */
    total?: number;
    /** Time taken in milliseconds */
    took?: number;
}

/**
 * SearchResult property
 * Type: object
 */
export interface SearchResult {
    /**
     * id property
     * Type: string
     */
    id?: string;
    /**
     * type property
     * Type: string, Allowed values: "user", "product"
     */
    type?: "user" | "product";
    /**
     * title property
     * Type: string
     */
    title?: string;
    /**
     * description property
     * Type: string
     */
    description?: string;
    /**
     * url property
     * Type: string, Format: uri
     */
    url?: string;
    /**
     * score property
     * Type: number, Minimum: 0, Maximum: 1
     */
    score?: number;
}

/**
 * FileInfo property
 * Type: object
 */
export interface FileInfo {
    /**
     * id property
     * Type: string, Format: uuid
     */
    id?: string;
    /**
     * filename property
     * Type: string
     */
    filename?: string;
    /**
     * originalName property
     * Type: string
     */
    originalName?: string;
    /**
     * size property
     * Type: integer, Minimum: 0
     */
    size?: number;
    /**
     * mimeType property
     * Type: string
     */
    mimeType?: string;
    /**
     * url property
     * Type: string, Format: uri
     */
    url?: string;
    /**
     * uploadedAt property
     * Type: string, Format: date-time
     */
    uploadedAt?: string;
}

/**
 * Pagination property
 * Type: object
 */
export interface Pagination {
    /**
     * page property
     * Type: integer, Minimum: 1
     */
    page?: number;
    /**
     * limit property
     * Type: integer, Minimum: 1
     */
    limit?: number;
    /**
     * totalPages property
     * Type: integer, Minimum: 0
     */
    totalPages?: number;
    /**
     * totalItems property
     * Type: integer, Minimum: 0
     */
    totalItems?: number;
    /**
     * hasNext property
     * Type: boolean
     */
    hasNext?: boolean;
    /**
     * hasPrev property
     * Type: boolean
     */
    hasPrev?: boolean;
}

/**
 * HealthStatus property
 * Type: object
 */
export interface HealthStatus {
    /**
     * status property
     * Type: string, Allowed values: "healthy", "degraded", "unhealthy"
     */
    status?: "healthy" | "degraded" | "unhealthy";
    /**
     * timestamp property
     * Type: string, Format: date-time
     */
    timestamp?: string;
    /**
     * version property
     * Type: string
     */
    version?: string;
    /** Uptime in seconds */
    uptime?: number;
}

/**
 * ErrorResponse property
 * Type: object
 */
export interface ErrorResponse {
    /**
     * code property
     * Type: string
     */
    code: string;
    /**
     * message property
     * Type: string
     */
    message: string;
    /**
     * details property
     * Type: object
     */
    details?: Record<string, unknown>;
    /**
     * traceId property
     * Type: string, Format: uuid
     */
    traceId?: string;
}
