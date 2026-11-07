//! Native side of Markdown Editor — the ONLY Rust in the project.
//!
//! The whole app (UI, Markdown, editing, file workflow) is the web code in
//! ../src. This file just:
//!   1. turns on the two official plugins the web code calls from JavaScript
//!      (file dialogs, reading/writing files);
//!   2. forwards "Open With…" / double-clicked .md files from macOS to the
//!      web page, which is the one thing that can only be received natively.
//!
//! You should rarely, if ever, need to edit this file.

use std::sync::Mutex;
use tauri::Manager;

/// Files macOS asked us to open that the web page hasn't collected yet.
///
/// Why a waiting list instead of sending them straight to the page? When you
/// double-click a .md file while the app is CLOSED, macOS hands it over during
/// launch — before the page has loaded and could listen for it. Keeping the
/// paths here lets the page collect them whenever it's ready.
#[derive(Default)]
struct PendingFiles(Mutex<Vec<String>>);

/// Called from JavaScript: "give me (and forget) the files waiting for me".
#[tauri::command]
fn take_pending_files(pending: tauri::State<PendingFiles>) -> Vec<String> {
    std::mem::take(&mut *pending.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init()) // window.__TAURI__.dialog
        .plugin(tauri_plugin_fs::init()) // window.__TAURI__.fs
        .manage(PendingFiles::default())
        .invoke_handler(tauri::generate_handler![take_pending_files])
        .build(tauri::generate_context!())
        .expect("error while building the Markdown Editor app")
        .run(|app, event| {
            // macOS: Finder "Open With…", double-click, or dropping a file on the Dock icon.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                let paths = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().into_owned());
                app.state::<PendingFiles>().0.lock().unwrap().extend(paths);
                // Nudge the page (if it's already running) to collect them now.
                use tauri::Emitter;
                let _ = app.emit("open-files-pending", ());
            }
            // Silences "unused" warnings on non-macOS builds.
            let _ = (app, &event);
        });
}
