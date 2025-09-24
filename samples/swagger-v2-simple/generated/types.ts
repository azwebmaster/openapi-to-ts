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
