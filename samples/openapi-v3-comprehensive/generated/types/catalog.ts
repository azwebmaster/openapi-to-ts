/**
 * Category property
 * Type: object
 */
export interface Category {
    /**
     * id property
     * Type: string, Format: uuid
     */
    id?: string;
    /**
     * name property
     * Type: string
     */
    name?: string;
    /**
     * slug property
     * Type: string, Pattern: ^[a-z0-9]+(?:-[a-z0-9]+)*$
     */
    slug?: string;
    /**
     * description property
     * Type: string
     */
    description?: string;
    /**
     * parent_id property
     * Type: string, Format: uuid, Nullable: true
     */
    parent_id?: (string | null);
    /**
     * subcategories property
     * Type: array
     */
    subcategories?: Array<Category>;
    /**
     * product_count property
     * Type: integer, Minimum: 0
     */
    product_count?: number;
}
