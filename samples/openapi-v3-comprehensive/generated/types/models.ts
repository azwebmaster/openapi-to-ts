import type { UserPreferences } from "./auth.js";

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
     * age property
     * Type: integer, Minimum: 0, Maximum: 150
     */
    age?: number;
    /**
     * bio property
     * Type: string, Max length: 500
     */
    bio?: string;
    /** preferences property */
    preferences?: UserPreferences;
}

/**
 * UpdateUserRequest property
 * Type: object
 */
export interface UpdateUserRequest {
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
     * age property
     * Type: integer, Minimum: 0, Maximum: 150
     */
    age?: number;
    /**
     * bio property
     * Type: string, Max length: 500
     */
    bio?: string;
    /** preferences property */
    preferences?: UserPreferences;
}

/**
 * PatchUserRequest property
 * Type: object
 */
export interface PatchUserRequest {
    /**
     * email property
     * Type: string, Format: email
     */
    email?: string;
    /**
     * name property
     * Type: string, Min length: 1, Max length: 100
     */
    name?: string;
    /**
     * age property
     * Type: integer, Minimum: 0, Maximum: 150
     */
    age?: number;
    /**
     * bio property
     * Type: string, Max length: 500
     */
    bio?: string;
    /** preferences property */
    preferences?: UserPreferences;
}

/**
 * Address property
 * Type: object
 */
export interface Address {
    /**
     * type property
     * Type: string, Allowed values: "home", "work", "other"
     */
    type: "home" | "work" | "other";
    /**
     * street property
     * Type: string, Min length: 1, Max length: 200
     */
    street: string;
    /**
     * city property
     * Type: string, Min length: 1, Max length: 100
     */
    city: string;
    /**
     * state property
     * Type: string, Max length: 100
     */
    state?: string;
    /**
     * postal_code property
     * Type: string, Max length: 20
     */
    postal_code?: string;
    /**
     * country property
     * Type: string, Min length: 2, Max length: 2, Pattern: ^[A-Z]{2}$
     */
    country: string;
    /**
     * coordinates property
     * Type: object
     */
    coordinates?: {
        /** latitude property
        Type: number, Minimum: -90, Maximum: 90 */
        latitude?: number;
        /** longitude property
        Type: number, Minimum: -180, Maximum: 180 */
        longitude?: number;
            };
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
     * total_pages property
     * Type: integer, Minimum: 0
     */
    total_pages?: number;
    /**
     * total_items property
     * Type: integer, Minimum: 0
     */
    total_items?: number;
    /**
     * has_next property
     * Type: boolean
     */
    has_next?: boolean;
    /**
     * has_prev property
     * Type: boolean
     */
    has_prev?: boolean;
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
     * facets property
     * Type: object
     */
    facets?: Record<string, unknown>;
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
     * Type: string, Allowed values: "user", "post", "comment", "product"
     */
    type?: "user" | "post" | "comment" | "product";
    /**
     * title property
     * Type: string
     */
    title?: string;
    /**
     * excerpt property
     * Type: string
     */
    excerpt?: string;
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
    /**
     * highlights property
     * Type: array
     */
    highlights?: Array<string>;
}

/**
 * Facet property
 * Type: object
 */
export interface Facet {
    /**
     * value property
     * Type: string
     */
    value?: string;
    /**
     * count property
     * Type: integer
     */
    count?: number;
    /**
     * selected property
     * Type: boolean
     */
    selected?: boolean;
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
     * original_name property
     * Type: string
     */
    original_name?: string;
    /**
     * size property
     * Type: integer, Minimum: 0
     */
    size?: number;
    /**
     * mime_type property
     * Type: string
     */
    mime_type?: string;
    /**
     * url property
     * Type: string, Format: uri
     */
    url?: string;
    /**
     * thumbnail_url property
     * Type: string, Format: uri, Nullable: true
     */
    thumbnail_url?: (string | null);
    /**
     * metadata property
     * Type: object
     */
    metadata?: {
        /** width property
        Type: integer */
        width?: number;
        /** height property
        Type: integer */
        height?: number;
        /** duration property
        Type: number */
        duration?: number;
            };
    /**
     * uploaded_at property
     * Type: string, Format: date-time
     */
    uploaded_at?: string;
}

/**
 * ExportData property
 * Type: object
 */
export interface ExportData {
    /**
     * format property
     * Type: string, Allowed values: "json", "csv", "xml", "pdf"
     */
    format?: "json" | "csv" | "xml" | "pdf";
    /** data property */
    data?: (Array<Record<string, unknown>> | string);
    /**
     * metadata property
     * Type: object
     */
    metadata?: {
        /** generated_at property
        Type: string, Format: date-time */
        generated_at?: string;
        /** total_records property
        Type: integer */
        total_records?: number;
        /** filters_applied property
        Type: object */
        filters_applied?: Record<string, unknown>;
            };
}

/**
 * Webhook property
 * Type: object
 */
export interface Webhook {
    /**
     * id property
     * Type: string, Format: uuid
     */
    id?: string;
    /**
     * url property
     * Type: string, Format: uri
     */
    url?: string;
    /**
     * events property
     * Type: array
     */
    events?: Array<"user.created" | "user.updated" | "user.deleted" | "order.created" | "order.updated">;
    /**
     * secret property
     * Type: string, Write-only: true
     */
    secret?: string;
    /**
     * is_active property
     * Type: boolean, Default: true
     */
    is_active?: boolean;
    /** retry_config property */
    retry_config?: RetryConfig;
    /**
     * created_at property
     * Type: string, Format: date-time
     */
    created_at?: string;
}

/**
 * CreateWebhookRequest property
 * Type: object
 */
export interface CreateWebhookRequest {
    /**
     * url property
     * Type: string, Format: uri
     */
    url: string;
    /**
     * events property
     * Type: array, Min items: 1
     */
    events: Array<"user.created" | "user.updated" | "user.deleted" | "order.created" | "order.updated">;
    /**
     * secret property
     * Type: string, Min length: 10
     */
    secret?: string;
    /** retry_config property */
    retry_config?: RetryConfig;
}

/**
 * RetryConfig property
 * Type: object
 */
export interface RetryConfig {
    /**
     * max_attempts property
     * Type: integer, Default: 3, Minimum: 1, Maximum: 10
     */
    max_attempts?: number;
    /**
     * backoff_multiplier property
     * Type: number, Default: 2, Minimum: 1
     */
    backoff_multiplier?: number;
    /**
     * Initial delay in milliseconds
     * Default: 1000, Minimum: 100
     */
    initial_delay?: number;
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
    /**
     * services property
     * Type: object
     */
    services?: Record<string, unknown>;
}

/**
 * ServiceHealth property
 * Type: object
 */
export interface ServiceHealth {
    /**
     * status property
     * Type: string, Allowed values: "up", "down", "unknown"
     */
    status?: "up" | "down" | "unknown";
    /**
     * response_time property
     * Type: number, Minimum: 0
     */
    response_time?: number;
    /**
     * last_check property
     * Type: string, Format: date-time
     */
    last_check?: string;
}

/**
 * BaseNotification property
 * Type: object
 */
export interface BaseNotification {
    /**
     * id property
     * Type: string, Format: uuid
     */
    id: string;
    /**
     * type property
     * Type: string
     */
    type: string;
    /**
     * message property
     * Type: string
     */
    message: string;
    /**
     * read property
     * Type: boolean, Default: false
     */
    read?: boolean;
    /**
     * created_at property
     * Type: string, Format: date-time
     */
    created_at: string;
}

/** EmailNotification property */
export type EmailNotification = (BaseNotification & { type?: "email"; subject?: string; from?: string });
/** PushNotification property */
export type PushNotification = (BaseNotification & { type?: "push"; title?: string; icon?: string; action_url?: string });
/** SMSNotification property */
export type SMSNotification = (BaseNotification & { type?: "sms"; phone_number?: string });

/**
 * DateRange property
 * Type: object
 */
export interface DateRange {
    /**
     * start_date property
     * Type: string, Format: date
     */
    start_date: string;
    /**
     * end_date property
     * Type: string, Format: date
     */
    end_date: string;
}

/**
 * AnalyticsReport property
 * Type: object
 */
export interface AnalyticsReport {
    /** period property */
    period?: DateRange;
    /**
     * metrics property
     * Type: array
     */
    metrics?: Array<string>;
    /**
     * dimensions property
     * Type: array
     */
    dimensions?: Array<string>;
    /**
     * data property
     * Type: array
     */
    data?: Array<Record<string, unknown>>;
    /**
     * totals property
     * Type: object
     */
    totals?: Record<string, unknown>;
    /**
     * filters_applied property
     * Type: object
     */
    filters_applied?: Record<string, unknown>;
    /**
     * generated_at property
     * Type: string, Format: date-time
     */
    generated_at?: string;
}

/**
 * Event property
 * Type: object
 */
export interface Event {
    /**
     * id property
     * Type: string, Format: uuid, Read-only: true
     */
    id: string;
    /**
     * type property
     * Type: string, Allowed values: "click", "view", "action", "custom"
     */
    type: "click" | "view" | "action" | "custom";
    /**
     * source property
     * Type: string, Allowed values: "web", "mobile", "api"
     */
    source?: "web" | "mobile" | "api";
    /**
     * metadata property
     * Type: object
     */
    metadata?: Record<string, unknown>;
    /**
     * created_at property
     * Type: string, Format: date-time, Read-only: true
     */
    created_at: string;
}

/**
 * EventMetadata property
 * Type: object
 */
export interface EventMetadata {
    /**
     * type property
     * Type: string, Allowed values: "click", "view", "action", "custom"
     */
    type?: "click" | "view" | "action" | "custom";
    /**
     * metadata property
     * Type: object
     */
    metadata?: Record<string, unknown>;
    /** Additional custom metadata fields */
    custom_fields?: Record<string, unknown>;
}

/**
 * DeleteEventsRequest property
 * Type: object
 */
export interface DeleteEventsRequest {
    /**
     * Optional reason for deletion
     * Max length: 500
     */
    reason?: string;
    /**
     * Confirmation flag for deletion
     * Default: false
     */
    confirm?: boolean;
    /** Additional metadata about the deletion */
    metadata?: Record<string, unknown>;
}

/**
 * ValidationError property
 * Type: object
 */
export interface ValidationError {
    /**
     * code property
     * Type: string, Allowed values: "validation_error"
     */
    code: "validation_error";
    /**
     * message property
     * Type: string
     */
    message: string;
    /**
     * errors property
     * Type: array
     */
    errors: Array<FieldError>;
}

/**
 * FieldError property
 * Type: object
 */
export interface FieldError {
    /**
     * field property
     * Type: string
     */
    field: string;
    /**
     * code property
     * Type: string, Allowed values: "required", "invalid", "too_short", "too_long", "invalid_format"
     */
    code: "required" | "invalid" | "too_short" | "too_long" | "invalid_format";
    /**
     * message property
     * Type: string
     */
    message: string;
    /** value property */
    value?: (string | number | boolean | Array<unknown> | Record<string, unknown>);
}
