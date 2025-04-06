use serde_json::{from_str, to_string_pretty, Value};

pub fn format_json(json_str: &str) -> Result<String, String> {
    let parsed: Value = from_str(json_str).map_err(|e| e.to_string())?;
    let formatted = to_string_pretty(&parsed).map_err(|e| e.to_string())?;
    Ok(formatted)
}
