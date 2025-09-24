/**
 * User property
 * Type: object
 */
export interface User {
    /**
     * id property
     * Type: integer, Format: int64
     */
    id: number;
    /**
     * username property
     * Type: string
     */
    username: string;
    /**
     * email property
     * Type: string, Format: email
     */
    email: string;
    /**
     * createdAt property
     * Type: string, Format: date-time
     */
    createdAt?: string;
}

/**
 * Product property
 * Type: object
 */
export interface Product {
    /**
     * id property
     * Type: string
     */
    id: string;
    /**
     * name property
     * Type: string
     */
    name: string;
    /**
     * price property
     * Type: number, Format: float
     */
    price: number;
    /**
     * inStock property
     * Type: boolean
     */
    inStock?: boolean;
}

/**
 * ErrorResponse property
 * Type: object
 */
export interface ErrorResponse {
    /**
     * code property
     * Type: integer
     */
    code: number;
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
}
