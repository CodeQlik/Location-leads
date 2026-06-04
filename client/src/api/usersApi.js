import axios from "axios";

const API_BASE = "https://map.codeqlik.com/api";

export const getUsers = (token) => {
    return axios.get(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
    });
};

export const createUser = (token, userData) => {
    return axios.post(`${API_BASE}/users`, userData, {
        headers: { Authorization: `Bearer ${token}` },
    });
};

export const updateUserStatus = (token, userId, isActive) => {
    return axios.patch(
        `${API_BASE}/users/${userId}/status`,
        { isActive },
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
};

export const updateUserPermissions = (token, userId, permissions) => {
    return axios.patch(
        `${API_BASE}/users/${userId}/permissions`,
        { permissions },
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
};
