// import { invoke } from '@tauri-apps/api/core';

// Tidak perlu import jika pakai global __TAURI__

window.interceptedRequests = [];

const recentlyLoggedUrls = new Set();
const MAX_LOGGED_URLS = 20;

function shouldLogUrl(url) {
    console.log("window.__TAURI__", window.__TAURI__);
    console.log("window.__TAURI__.event", window.__TAURI__.event);
    console.log("window.__TAURI__.capabilities", window.__TAURI__.capabilities);

    if (url.includes('ipc.localhost')) return false;
    if (url.includes('.css') || url.includes('.js') || url.includes('.svg') || url.includes('.png') || url.includes('.jpg') || url.includes('.woff')) return false;
    if (recentlyLoggedUrls.has(url)) return false;
    recentlyLoggedUrls.add(url);
    if (recentlyLoggedUrls.size > MAX_LOGGED_URLS) {
        const firstItem = recentlyLoggedUrls.values().next().value;
        recentlyLoggedUrls.delete(firstItem);
    }
    return true;
}

const originalFetch = window.fetch;
window.fetch = async (...args) => {

    try {
        const [resource, options] = args;
        const response = await originalFetch(...args);
        const clonedResponse = response.clone();
        clonedResponse.text().then((body) => {
            const requestData = {
                type: "fetch",
                url: resource,
                method: options?.method || "GET",
                headers: options?.headers || {},
                body: options?.body || null,
                response: body
            };
            if (shouldLogUrl(resource.toString())) {
                console.log("📥 Fetch Intercepted:", resource);
                window.interceptedRequests.push(requestData);
                window.__TAURI__.event.emit("http-request", requestData);
            }
        });
        return response;
    } catch (err) {
        console.error("Error in fetch interceptor:", err);
        return originalFetch(...args);
    }
};

const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener("load", function () {
        const requestData = {
            type: "xhr",
            url: this.responseURL,
            method: this._method || this.method || "POST",
            headers: this.getAllResponseHeaders(),
            body: body,
            response: this.responseText
        };
        if (shouldLogUrl(this.responseURL)) {
            console.log("📥 XHR Intercepted:", this.responseURL);
            window.interceptedRequests.push(requestData);
            window.__TAURI__.event.emit("http-request", requestData);
            // window.__TAURI__.core.invoke("save_request", { request: requestData })
            //     .catch(err => console.error("Error invoking save_request:", err));
        }
    });
    return originalSend.apply(this, arguments);
};

const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url) {
    this._method = method;
    return originalOpen.apply(this, arguments);
};

console.log("HTTP interceptor initialized successfully!");