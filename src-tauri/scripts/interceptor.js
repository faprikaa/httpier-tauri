window.interceptedRequests = [];

const recentlyLoggedUrls = new Set();
const MAX_LOGGED_URLS = 20;

// UTILS
// Fungsi untuk mengonversi string header ke objek JSON
function parseHeadersToJson(headerString) {
    console.log("Header string:", headerString);
    console.log("Typeof Header string:", typeof headerString);
    if (typeof headerString !== 'string') {
        console.error("Invalid headerString: Expected string, got:", headerString);
        return {};
    }
    const headersObj = {};
    const lines = headerString.trim().split(/\r?\n/);
    
    // Proses setiap baris
    for (const line of lines) {
        // Pastikan baris tidak kosong
        if (line.trim() === "") continue;
        
        // Pisahkan key dan value berdasarkan colon pertama
        const firstColonIndex = line.indexOf(":");
        if (firstColonIndex === -1) continue; // Lewati jika tidak ada colon
        
        const key = line.substring(0, firstColonIndex).trim().toLowerCase(); // Normalisasi ke lowercase
        const value = line.substring(firstColonIndex + 1).trim();
        
        // Tambahkan ke objek
        headersObj[key] = value;
    }
    
    return headersObj;
}

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
// ================ done utils =================

// MAIN
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
                body: JSON.parse(options?.body || null),
                response: JSON.parse(body)
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
            headers: parseHeadersToJson(this.getAllResponseHeaders()),
            body: JSON.parse(body),
            response: JSON.parse(this.responseText)
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