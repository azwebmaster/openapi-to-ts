import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/** get-special_chars namespace operations */
export interface GetSpecialCharsOperations {
    /** Special characters in operationId */
    getSpecialCharsEndpoint(config?: AxiosRequestConfig): Promise<AxiosResponse<void>>;
}

export class GetSpecialCharsNamespace {
    private readonly client: AxiosInstance;

    constructor(client: AxiosInstance) {
        this.client = client;
    }

    /**
     * Special characters in operationId
     *
     * Test operationId with hyphens, underscores, and dots
     *
     * @operationId get-special_chars.endpoint
     *
     * @returns Success
     */
    public async getSpecialCharsEndpoint(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.get(`/special-chars`, config);
    }
}

export const createGetSpecialCharsNamespace = (client: AxiosInstance) => new GetSpecialCharsNamespace(client);
