mod app;
mod commands;
mod framework;
mod internal_cli;
mod platform;
mod plugins;
mod state;

pub fn run() {
    if internal_cli::maybe_handle_internal_cli_action() {
        return;
    }
    if let Err(error) = app::bootstrap::build().run(tauri::generate_context!()) {
        eprintln!("failed to run Agent Studio desktop: {error}");
        std::process::exit(1);
    }
}
