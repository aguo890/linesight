/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

// src/api/axios-client.ts
import axios, { type AxiosRequestConfig } from 'axios';
import { authStorage } from '@/lib/authStorage';

// 1. Create a base axios instance
export const AXIOS_INSTANCE = axios.create({
    baseURL: 'http://127.0.0.1:8000', // Your backend URL
});

// 2. Add an interceptor to inject the token
AXIOS_INSTANCE.interceptors.request.use((config) => {
    const token = authStorage.getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 3. Define the custom fetcher for Orval
export const customInstance = <T>(
    config: AxiosRequestConfig,
    options?: AxiosRequestConfig,
): Promise<T> => {
    const source = axios.CancelToken.source();
    const promise = AXIOS_INSTANCE({
        ...config,
        ...options,
        cancelToken: source.token,
    }).then(({ data }) => data);

    // @ts-expect-error
    promise.cancel = () => {
        source.cancel('Query was cancelled');
    };

    return promise;
};
