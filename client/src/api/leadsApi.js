import axios from "axios";
import { API_BASE } from "../config/api";

const cleanParams = (params) => {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== "" && value !== undefined && value !== null && value !== false)
    );
};

const buildLeadParams = (filters = {}) => cleanParams({
    search: filters.search || "",
    category: filters.category || "",
    city: filters.city || "",
    minRating: filters.minRating || "",
    dateFrom: filters.dateFrom || "",
    dateTo: filters.dateTo || "",
    hasPhone: filters.hasPhone ? "true" : "",
    hasEmail: filters.hasEmail ? "true" : "",
    hasWebsite: filters.hasWebsite ? "true" : "",
    userId: filters.userId || "",
    _t: Date.now(),
});

export const getLeads = (token, page = 1, limit = 50, filters = {}) => {
    return axios.get(`${API_BASE}/leads`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: cleanParams({
            page,
            limit,
            ...buildLeadParams(filters),
        }),
    });
};

export const exportLeadsCsv = (token, filters = {}) => {
    return axios.get(`${API_BASE}/leads/export`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: buildLeadParams(filters),
        responseType: "blob",
    });
};
