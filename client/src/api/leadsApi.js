import axios from "axios";
import { API_BASE } from "../config/api";

export const getLeads = (token, page = 1, limit = 50) => {
    return axios.get(`${API_BASE}/leads?page=${page}&limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};
