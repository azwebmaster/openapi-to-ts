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
     * name property
     * Type: string, Min length: 1, Max length: 100
     */
    name: string;
    /**
     * email property
     * Type: string, Format: email
     */
    email: string;
    /**
     * age property
     * Type: integer, Minimum: 0, Maximum: 150
     */
    age?: number;
    /**
     * createdAt property
     * Type: string, Format: date-time, Read-only: true
     */
    createdAt?: string;
}

/**
 * CreateUserRequest property
 * Type: object
 */
export interface CreateUserRequest {
    /**
     * name property
     * Type: string, Min length: 1, Max length: 100
     */
    name: string;
    /**
     * email property
     * Type: string, Format: email
     */
    email: string;
    /**
     * age property
     * Type: integer, Minimum: 0, Maximum: 150
     */
    age?: number;
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
     * email property
     * Type: string, Format: email
     */
    email?: string;
    /**
     * age property
     * Type: integer, Minimum: 0, Maximum: 150
     */
    age?: number;
}
