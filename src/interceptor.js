import { invoke } from '@tauri-apps/api/core';

// Initialize the interceptedRequests array
window.interceptedRequests = [];

/**
 * Converts an XML document to a JSON object
 * @param {Document} xml - The XML document to convert
 * @returns {Object} - The resulting JSON object
 */
function xmlToJson(xml) {
  // Create the return object
  let obj = {};

  if (xml.nodeType === 1) { // element
    // Process attributes
    if (xml.attributes.length > 0) {
      obj["@attributes"] = {};
      for (let j = 0; j < xml.attributes.length; j++) {
        const attribute = xml.attributes.item(j);
        obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
      }
    }
  } else if (xml.nodeType === 3) { // text
    obj = xml.nodeValue.trim();
    return obj === "" ? null : obj;
  }

  // Process children
  if (xml.hasChildNodes()) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const item = xml.childNodes.item(i);
      const nodeName = item.nodeName;
      
      // Skip #text nodes with only whitespace
      if (nodeName === "#text" && item.nodeValue.trim() === "") continue;
      
      // Convert #text to actual text value
      const normalizedNodeName = nodeName === "#text" ? "text" : nodeName;
      
      const itemJson = xmlToJson(item);
      if (itemJson !== null) {
        if (obj[normalizedNodeName] === undefined) {
          obj[normalizedNodeName] = itemJson;
        } else {
          if (!Array.isArray(obj[normalizedNodeName])) {
            obj[normalizedNodeName] = [obj[normalizedNodeName]];
          }
          obj[normalizedNodeName].push(itemJson);
        }
      }
    }
  }
  
  return obj;
}

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
                    headers: JSON.parse(options?.headers || null),
                    body: JSON.parse(options?.body || null),
                    response: JSON.parse(body)
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
                // Parse response based on content type
                let parsedResponse;
                const contentType = this.getResponseHeader('content-type');
                
                try {
                    if (contentType && contentType.includes('application/xml') || contentType && contentType.includes('text/xml')) {
                        // Convert XML to JSON
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(this.responseText, 'text/xml');
                        parsedResponse = xmlToJson(xmlDoc);
                    } else {
                        // Try to parse as JSON
                        parsedResponse = JSON.parse(this.responseText);
                        console.log("NOT XML")
                    }
                } catch (e) {
                    // If parsing fails, use the raw response text
                    parsedResponse = JSON.parse(this.responseText);
                    console.log("ERROR PARSING")
                }
                
                const requestData = {
                    type: "xhr",
                    url: this.responseURL,
                    method: this._method || this.method || "POST",
                    headers: this.getAllResponseHeaders(),
                    body: body,
                    response: parsedResponse
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