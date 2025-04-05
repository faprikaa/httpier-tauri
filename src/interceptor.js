import { invoke } from '@tauri-apps/api/core';

// Initialize the interceptedRequests array
window.interceptedRequests = [];

// Track last logged URLs to prevent spam
const recentlyLoggedUrls = new Set();
const MAX_LOGGED_URLS = 20;

// Helper to prevent log spam
function shouldLogUrl(url) {
    // Skip logging for internal IPC communication
    if (url.includes('ipc.localhost')) {
        return false;
    }

    // Skip logging for common assets that generate lots of requests
    if (url.includes('.css') || url.includes('.js') ||
        url.includes('.svg') || url.includes('.png') ||
        url.includes('.jpg') || url.includes('.woff')) {
        return false;
    }

    // Don't log duplicate URLs in a short timeframe
    if (recentlyLoggedUrls.has(url)) {
        return false;
    }

    // Add to recent logs and remove oldest if needed
    recentlyLoggedUrls.add(url);
    if (recentlyLoggedUrls.size > MAX_LOGGED_URLS) {
        const firstItem = recentlyLoggedUrls.values().next().value;
        recentlyLoggedUrls.delete(firstItem);
    }

    return true;
}

// Set up fetch interceptor
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    try {
        const [resource, options] = args;
        const response = await originalFetch(...args);
        const clonedResponse = response.clone();

        clonedResponse.text().then(body => {
            try {
                const requestData = {
                    type: "fetch",
                    url: resource,
                    method: options?.method || "GET",
                    headers: options?.headers || {},
                    body: options?.body || null,
                    response: body
                };

                // invoke("save_request", { request: requestData })
                //     .catch(err => console.error("Error invoking save_request:", err));

                // Only log if it passes our filter
                if (shouldLogUrl(resource.toString())) {
                    console.log("📥 Fetch Intercepted:", resource);
                    window.interceptedRequests.push(requestData);
                }

            } catch (err) {
                console.error("Error processing fetch response:", err);
            }
        }).catch(err => console.error("Error getting response text:", err));

        return response;
    } catch (err) {
        console.error("Error in fetch interceptor:", err);
        return originalFetch(...args);
    }
};

// Set up XMLHttpRequest interceptor
const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (body) {
    try {
        this.addEventListener("load", function () {
            try {
                const requestData = {
                    type: "xhr",
                    url: this.responseURL,
                    method: this._method || this.method || "POST",
                    headers: this.getAllResponseHeaders(),
                    body: body,
                    response: this.responseText
                };

                window.interceptedRequests.push(requestData);
                invoke("save_request", { request: requestData })
                    .catch(err => console.error("Error invoking save_request:", err));

                // Only log if it passes our filter
                if (shouldLogUrl(this.responseURL)) {
                    console.log("📥 XHR Intercepted:", this.responseURL);
                }
            } catch (err) {
                console.error("Error processing XHR response:", err);
            }
        });

        return originalSend.apply(this, arguments);
    } catch (err) {
        console.error("Error in XHR interceptor:", err);
        return originalSend.apply(this, arguments);
    }
};

// Store the original open method to capture the HTTP method
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url) {
    this._method = method;
    return originalOpen.apply(this, arguments);
};

console.log("HTTP interceptor initialized successfully!");

export default {};