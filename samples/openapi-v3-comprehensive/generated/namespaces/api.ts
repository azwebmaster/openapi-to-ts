import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/** api namespace operations */
export interface ApiOperations {
    /** Get resources with slash in operationId */
    v1GetResources(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Record<string, unknown>>>>;
}

export class ApiNamespace {
    private readonly client: AxiosInstance;

    constructor(client: AxiosInstance) {
        this.client = client;
    }

    /**
     * Get resources with slash in operationId
     *
     * Test operationId containing forward slashes
     *
     * @operationId api/v1/getResources
     *
     * @returns Resources list
     */
    public async v1GetResources(config?: AxiosRequestConfig): Promise<AxiosResponse<Array<Record<string, unknown>>>> {
        return this.client.get(`/api/v1/resources`, config);
    }
}

export const createApiNamespace = (client: AxiosInstance) => new ApiNamespace(client);
