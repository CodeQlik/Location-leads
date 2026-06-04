import axios from "axios";

const API_BASE = "https://map.codeqlik.com/api";

export const getLeads = (token, page = 1, limit = 50) => {
    return axios.get(`${API_BASE}/leads?page=${page}&limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};
