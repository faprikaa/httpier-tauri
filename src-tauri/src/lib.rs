mod utils;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Listener, Manager, WebviewUrl, WebviewWindowBuilder};
use utils::format_json;
const INTERCEPTOR_JS: &str = include_str!("../scripts/interceptor.js");

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// remember to call `.manage(MyState::default())`
#[tauri::command]
fn printlnrust(message: &str) -> () {
    println!("✨ {}", message);
}

#[tauri::command]
fn save_request(request: serde_json::Value) -> () {
    println!("Intercepted request: {:?}", request);
    // Here you can implement logic to save the request to a file or database
    // Ok(())
}

#[tauri::command]
async fn open_url_to_new_window(app: AppHandle, mut url: String) -> Result<(), String> {
    // Changed to String
    if url.is_empty() {
        // return Err("URL cannot be empty".to_string());
        url = "https://conduit-realworld-example-app.fly.dev/".to_string();
    }

    let parsed_url = tauri::Url::parse(&url).map_err(|e| format!("Failed to parse URL: {}", e))?;
    let webview_url = WebviewUrl::External(parsed_url.into());

    let unique_label = format!(
        "window-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );

    // Langsung buat dan tampilkan jendela tanpa spawn
    let webview_window = WebviewWindowBuilder::new(&app, &unique_label, webview_url)
        .title("New Window")
        .inner_size(800.0, 600.0)
        .build()
        .map_err(|e| format!("Failed to build webview window: {}", e))?;

    // webview_window.add_capability("default").unwrap();

    // let caps = webview_window.get_capabilities();
    // println!("Capabilities: {:?}", caps);

    webview_window.open_devtools();

    webview_window
        .eval(INTERCEPTOR_JS)
        .map_err(|e| format!("Failed to evaluate script: {}", e))?;

    // Dengarkan event http-request dari interceptor
    webview_window.listen("http-request", move |event| {
        let payload = event.payload();
        println!();
        match format_json(payload.to_string().as_str()) {
            Ok(formatted) => {
                println!("Formatted Request:\n{}", formatted);
            }
            Err(e) => println!("Failed to format JSON: {}", e),
        } // Parse payload sebagai JSON jika perlu
        match serde_json::from_str::<Value>(payload) {
            Ok(request_data) => {
                // Contoh: Cetak URL dan metode
                if let Some(url) = request_data.get("url") {
                    if let Some(method) = request_data.get("method") {
                        println!("URL: {}, Method: {}", url, method);
                    }
                }

                let main_window = app.get_webview_window("main").unwrap();
                main_window.emit("http-request-rust", request_data).unwrap();
            }
            Err(e) => println!("Gagal parse payload: {}", e),
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // let url = tauri::Url::parse("https://conduit-realworld-example-app.fly.dev/").unwrap();
            // let webview_url = tauri::WebviewUrl::External(url.into());
            // let _webview_window_ =
            //     tauri::WebviewWindowBuilder::new(app, "label", webview_url).build();
            // Ok(())
            // let main_webview = app.get_webview_window("main").unwrap();
            // main_webview.listen("test-event", move |event| {
            //     let payload = event.payload();
            //     println!("Received event from main window: {}", payload);
            // });
            // // let script = include_str!("../../src/interceptor.js");
            // // webview.eval(script).unwrap();
            // // webview.eval("console.log('Hello, world!')").unwrap();

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_request,
            printlnrust,
            open_url_to_new_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
