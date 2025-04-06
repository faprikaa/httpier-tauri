<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

interface Request {
  type: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  response: string;
}

const requests = ref<Request[]>([]);
const selectedRequest = ref<Request | null>(null);
const customUrl = ref("");

// Function to load intercepted requests from window.interceptedRequests
function loadRequests() {
  // @ts-ignore - Access window.interceptedRequests which is defined in the interceptor script
  if (window.interceptedRequests) {
    // @ts-ignore
    requests.value = window.interceptedRequests;
    invoke("printlnrust", { message: `Loaded ${requests.value.length} intercepted requests` });
  }
}

// Function to open a URL in a new browser tab
async function openUrlRust(url: string) {
  // if (!url.startsWith('http://') && !url.startsWith('https://')) {
  //   url = 'https://' + url;
  // }

  try {
    await invoke("open_url_to_new_window", { url });
    invoke("printlnrust", { message: `Opening URL: ${url}` });
    customUrl.value = ""; // Clear the URL input after opening
  } catch (error) {
    console.error("Failed to open URL:", error);
    invoke("printlnrust", { message: `Error opening URL: ${error}` });
  }
}

// Load requests when component mounts and set up polling to refresh data
onMounted(async () => {
  loadRequests();

  await emit("test-event", "Hello from Vue");

  // Refresh requests every 2 seconds
  // setInterval(() => {
  //   loadRequests();
  // }, 2000);
});

// Function to format JSON for display
function formatJSON(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

// Function to view request details
function viewRequest(request: Request) {
  selectedRequest.value = request;
}

// Function to clear all requests
function clearRequests() {
  // @ts-ignore
  window.interceptedRequests = [];
  requests.value = [];
  selectedRequest.value = null;
  invoke("printlnrust", { message: "Cleared all requests" });
}

onMounted(() => {
  listen("http-request-rust", (event) => {
    console.log("Received HTTP request:", event);
  });
});
</script>

<template>
  <div class="container">
    <header>
      <h1>HttpIER - HTTP Request Interceptor</h1>
      <div class="url-opener">
        <input v-model="customUrl" placeholder="Enter a URL to open..." @keyup.enter="openUrlRust(customUrl)" />
        <button @click="openUrlRust(customUrl)">Buka</button>
      </div>
    </header>

    <main>
      <div class="requests-panel">
        <div class="panel-header">
          <h2>Intercepted Requests ({{ requests.length }})</h2>
          <button class="clear-btn" @click="clearRequests">Clear All</button>
        </div>

        <div v-if="requests.length === 0" class="no-requests">
          No requests intercepted yet. Try making a network request.
        </div>

        <div v-else class="request-list">
          <div v-for="(request, index) in requests" :key="index" class="request-item"
            :class="{ 'selected': selectedRequest === request }" @click="viewRequest(request)">
            <div class="request-method" :class="request.method.toLowerCase()">
              {{ request.method }}
            </div>
            <div class="request-url">{{ request.url }}</div>
            <div class="request-type">{{ request.type }}</div>
          </div>
        </div>
      </div>

      <div class="details-panel" v-if="selectedRequest">
        <h2>Request Details</h2>

        <div class="detail-section">
          <h3>General</h3>
          <div class="detail-item">
            <span class="detail-label">URL:</span>
            <span class="detail-value">{{ selectedRequest.url }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Method:</span>
            <span class="detail-value">{{ selectedRequest.method }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Type:</span>
            <span class="detail-value">{{ selectedRequest.type }}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Headers</h3>
          <pre class="code-block headers">{{ JSON.stringify(selectedRequest.headers, null, 2) }}</pre>
        </div>

        <div class="detail-section" v-if="selectedRequest.body">
          <h3>Request Body</h3>
          <pre class="code-block body">{{ formatJSON(selectedRequest.body) }}</pre>
        </div>

        <div class="detail-section">
          <h3>Response</h3>
          <pre class="code-block response">{{ formatJSON(selectedRequest.response) }}</pre>
        </div>
      </div>

      <div class="details-panel empty" v-else>
        <div class="select-request-prompt">
          Select a request to view details
        </div>
      </div>
    </main>
  </div>
</template>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

header {
  padding: 1rem;
  background-color: #2c3e50;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  font-size: 1.5rem;
  margin: 0;
}

.url-opener {
  display: flex;
  gap: 0.5rem;
}

.url-opener input {
  padding: 0.5rem;
  border-radius: 4px;
  border: none;
  width: 300px;
}

button {
  padding: 0.5rem 1rem;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

button:hover {
  background-color: #3aa876;
}

main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.requests-panel {
  width: 40%;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 1rem;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}

.clear-btn {
  background-color: #e74c3c;
  font-size: 0.8rem;
  padding: 0.3rem 0.6rem;
}

.clear-btn:hover {
  background-color: #c0392b;
}

.no-requests {
  padding: 2rem;
  text-align: center;
  color: #7f8c8d;
}

.request-list {
  overflow-y: auto;
  flex: 1;
}

.request-item {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.request-item:hover {
  background-color: #f5f5f5;
}

.request-item.selected {
  background-color: #e3f2fd;
}

.request-method {
  font-weight: bold;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.8rem;
  min-width: 50px;
  text-align: center;
}

.request-method.get {
  background-color: #4caf50;
  color: white;
}

.request-method.post {
  background-color: #2196f3;
  color: white;
}

.request-method.put {
  background-color: #ff9800;
  color: white;
}

.request-method.delete {
  background-color: #f44336;
  color: white;
}

.request-url {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.request-type {
  font-size: 0.8rem;
  color: #7f8c8d;
  background-color: #ecf0f1;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
}

.details-panel {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.details-panel.empty {
  display: flex;
  justify-content: center;
  align-items: center;
}

.select-request-prompt {
  color: #95a5a6;
  font-size: 1.2rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

h3 {
  margin-bottom: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #34495e;
}

.detail-item {
  display: flex;
  margin-bottom: 0.5rem;
}

.detail-label {
  font-weight: 600;
  width: 100px;
}

.code-block {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 1rem;
  overflow: auto;
  font-family: monospace;
  font-size: 0.9rem;
  max-height: 400px;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  .request-item {
    border-bottom: 1px solid #333;
  }

  .request-item:hover {
    background-color: #3a3a3a;
  }

  .request-item.selected {
    background-color: #263238;
  }

  .request-type {
    background-color: #37474f;
    color: #b0bec5;
  }

  .requests-panel {
    border-right: 1px solid #444;
  }

  .panel-header {
    border-bottom: 1px solid #444;
  }

  .no-requests {
    color: #b0bec5;
  }

  .select-request-prompt {
    color: #78909c;
  }

  .code-block {
    background-color: #263238;
    border: 1px solid #37474f;
    color: #eee;
  }
}
</style>