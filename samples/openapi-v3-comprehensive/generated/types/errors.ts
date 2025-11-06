/**
 * Error property
 * Type: object
 */
export interface Error {
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
     * trace_id property
     * Type: string, Format: uuid
     */
    trace_id?: string;
}
