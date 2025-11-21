// assets/js/auth.js
const API_BASE = "https://TON_BACKEND_ON_RENDER"; // <- remplace par ton URL

async function postJSON(url, body) {
    const res = await fetch(API_BASE + url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw json;
    return json;
}

async function registerUser(email, password, displayName) {
    return await postJSON("/api/auth/register", { email, password, displayName });
}

async function loginUser(email, password) {
    return await postJSON("/api/auth/login", { email, password });
}

async function logoutUser() {
    return await postJSON("/api/auth/logout", {});
}

async function refreshTokens() {
    return await postJSON("/api/auth/refresh", {});
}
