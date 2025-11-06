import type { Address } from "./models.js";

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
     * Type: string, Example: "user@example.com", Format: email
     */
    email: string;
    /**
     * name property
     * Type: string, Example: "John Doe", Min length: 1, Max length: 100
     */
    name: string;
    /**
     * avatar property
     * Type: string, Format: uri, Nullable: true
     */
    avatar?: (string | null);
    /**
     * age property
     * Type: integer, Minimum: 0, Maximum: 150, Nullable: true
     */
    age?: (number | null);
    /**
     * bio property
     * Type: string, Max length: 500, Nullable: true
     */
    bio?: (string | null);
    /** preferences property */
    preferences?: UserPreferences;
    /**
     * addresses property
     * Type: array
     */
    addresses?: Array<Address>;
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
    /**
     * updated_at property
     * Type: string, Format: date-time, Read-only: true
     */
    updated_at?: string;
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
    notifications?: {
        /** email property
        Type: boolean, Default: true */
        email?: boolean;
        /** push property
        Type: boolean, Default: true */
        push?: boolean;
        /** sms property
        Type: boolean, Default: false */
        sms?: boolean;
            };
    /**
     * privacy property
     * Type: object
     */
    privacy?: {
        /** profile_visibility property
        Type: string, Default: "public", Allowed values: "public", "private", "friends" */
        profile_visibility?: "public" | "private" | "friends";
        /** show_email property
        Type: boolean, Default: false */
        show_email?: boolean;
            };
}
