import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/** namespace namespace operations */
export interface NamespaceOperations {
    /** Namespaced action */
    actionCreate(config?: AxiosRequestConfig): Promise<AxiosResponse<void>>;
}

export class NamespaceNamespace {
    private readonly client: AxiosInstance;

    constructor(client: AxiosInstance) {
        this.client = client;
    }

    /**
     * Namespaced action
     *
     * Test deeply nested operationId with multiple slashes
     *
     * @operationId namespace/action/create
     *
     * @returns Action created
     */
    public async actionCreate(config?: AxiosRequestConfig): Promise<AxiosResponse<void>> {
        return this.client.post(`/namespaced/action`, undefined, config);
    }
}

export const createNamespaceNamespace = (client: AxiosInstance) => new NamespaceNamespace(client);
