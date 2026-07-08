use crate::framework::{paths::AppPaths, Result};
use std::{
    fs::OpenOptions,
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Debug)]
pub struct AppLogger {
    log_file: PathBuf,
}

impl AppLogger {
    pub fn new(log_file: PathBuf) -> Self {
        Self { log_file }
    }

    pub fn info(&self, message: &str) -> Result<()> {
        self.write("INFO", message)
    }

    #[allow(dead_code)]
    pub fn warn(&self, message: &str) -> Result<()> {
        self.write("WARN", message)
    }

    #[allow(dead_code)]
    pub fn error(&self, message: &str) -> Result<()> {
        self.write("ERROR", message)
    }

    fn write(&self, level: &str, message: &str) -> Result<()> {
        append_line(&self.log_file, level, message)
    }
}

pub fn init_logger(paths: &AppPaths) -> Result<AppLogger> {
    let logger = AppLogger::new(paths.main_log_file.clone());
    logger.info("Claw Studio desktop runtime initialized")?;
    Ok(logger)
}

pub fn append_line(path: &std::path::Path, level: &str, message: &str) -> Result<()> {
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    writeln!(file, "[{timestamp}] {level} {message}")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{append_line, init_logger};
    use crate::framework::paths::resolve_paths_for_root;

    #[test]
    fn appends_log_line() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let logger = init_logger(&paths).expect("logger");
        logger.warn("warm path").expect("warn log");
        append_line(&paths.main_log_file, "INFO", "hello world").expect("append log");
        let content = std::fs::read_to_string(&paths.main_log_file).expect("log content");

        assert!(content.contains("INFO hello world"));
        assert!(content.contains("WARN warm path"));
    }
}
