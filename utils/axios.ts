import axios from "axios";
import {BackendError} from "@/utils/backend";

export const instance = axios.create({
    baseURL:  import.meta.env.WXT_BACKEND,
    timeout: 5000,
});

// Every failed request becomes a BackendError, so callers can tell offline, expired session and server errors apart.
instance.interceptors.response.use(undefined, (error) => Promise.reject(BackendError.fromAxios(error)));
