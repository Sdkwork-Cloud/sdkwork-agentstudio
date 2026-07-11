use super::requests::ValidatedProcessRequest;
use crate::framework::{
    child_process::configure_hidden_child_process, events, runtime, FrameworkError, Result,
};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Read},
    process::{Child, Command, ExitStatus, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc, Mutex, MutexGuard,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Runtime};

static NEXT_PROCESS_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResult {
    pub process_id: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProcessOutputStream {
    Stdout,
    Stderr,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessOutputEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
    pub process_id: String,
    pub command: String,
    pub stream: ProcessOutputStream,
    pub chunk: String,
}

pub trait ProcessEventSink {
    fn emit_process_output(&self, payload: ProcessOutputEvent) -> Result<()>;
}

impl<R: Runtime> ProcessEventSink for AppHandle<R> {
    fn emit_process_output(&self, payload: ProcessOutputEvent) -> Result<()> {
        self.emit(events::PROCESS_OUTPUT, payload)
            .map_err(FrameworkError::from)
    }
}

#[derive(Clone, Debug, Default)]
pub(crate) struct NoopProcessEventSink;

impl ProcessEventSink for NoopProcessEventSink {
    fn emit_process_output(&self, _payload: ProcessOutputEvent) -> Result<()> {
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub(crate) struct ProcessRuntime {
    active_processes: Arc<Mutex<HashMap<String, ActiveProcessHandle>>>,
}

#[derive(Clone, Debug)]
struct ActiveProcessHandle {
    child: Arc<Mutex<Child>>,
    cancellation_requested: Arc<AtomicBool>,
    allow_cancellation: bool,
}

#[derive(Debug)]
struct OutputMessage {
    stream: ProcessOutputStream,
    chunk: String,
}

impl ProcessRuntime {
    pub(crate) fn new() -> Self {
        Self {
            active_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub(crate) fn run_with_sink<S, F>(
        &self,
        validated: ValidatedProcessRequest,
        process_id: Option<String>,
        job_id: Option<String>,
        allow_cancellation: bool,
        sink: &S,
        on_started: F,
    ) -> Result<ProcessResult>
    where
        S: ProcessEventSink,
        F: FnOnce(&str) -> Result<()>,
    {
        let process_id = process_id.unwrap_or_else(next_process_id);
        let command_display = validated.command_display();
        let runtime = self.clone();

        runtime::run_blocking("process.run_capture", move || {
            let mut process = Command::new(&validated.command);
            configure_hidden_child_process(&mut process);
            process.args(&validated.args);
            process.stdout(Stdio::piped());
            process.stderr(Stdio::piped());
            process.current_dir(&validated.cwd);
            process.env_clear();
            process.envs(validated.env.iter().cloned());

            let mut child = process.spawn()?;
            let stdout = child
                .stdout
                .take()
                .map(|stdout| Box::new(stdout) as Box<dyn Read + Send>);
            let stderr = child
                .stderr
                .take()
                .map(|stderr| Box::new(stderr) as Box<dyn Read + Send>);
            let child = Arc::new(Mutex::new(child));
            let cancellation_requested = Arc::new(AtomicBool::new(false));

            runtime.register_active_process(
                process_id.clone(),
                ActiveProcessHandle {
                    child: child.clone(),
                    cancellation_requested: cancellation_requested.clone(),
                    allow_cancellation,
                },
            )?;

            if let Err(error) = on_started(&process_id) {
                let _ = kill_child(&child);
                let _ = wait_child(&child);
                let _ = runtime.unregister_active_process(&process_id);
                return Err(error);
            }

            let wait_result = wait_for_completion(
                child,
                stdout,
                stderr,
                &job_id,
                &process_id,
                &command_display,
                validated.timeout_ms,
                sink,
            );

            let cleanup_result = runtime.unregister_active_process(&process_id);
            let was_cancelled = cancellation_requested.load(Ordering::Relaxed);

            cleanup_result?;

            if was_cancelled {
                return Err(FrameworkError::Cancelled(format!(
                    "process cancelled: {command_display}"
                )));
            }

            let (status, stdout, stderr) = wait_result?;
            map_result(status, &process_id, stdout, stderr, &command_display)
        })
    }

    pub(crate) fn cancel(&self, process_id: &str) -> Result<()> {
        let handle = self
            .lock_active_processes()?
            .get(process_id)
            .cloned()
            .ok_or_else(|| FrameworkError::NotFound(format!("process not found: {process_id}")))?;

        if !handle.allow_cancellation {
            return Err(FrameworkError::PolicyDenied {
                resource: process_id.to_string(),
                reason: "process profile does not allow cancellation".to_string(),
            });
        }

        handle.cancellation_requested.store(true, Ordering::Relaxed);
        let mut child = handle
            .child
            .lock()
            .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
        if child.try_wait()?.is_none() {
            child.kill()?;
        }

        Ok(())
    }

    pub(crate) fn cancel_all(&self) -> Result<()> {
        let handles = self
            .lock_active_processes()?
            .values()
            .cloned()
            .collect::<Vec<_>>();
        let mut failures = Vec::new();

        for handle in handles {
            if let Err(error) = force_terminate_handle(&handle) {
                failures.push(error.to_string());
            }
        }

        if failures.is_empty() {
            return Ok(());
        }

        Err(FrameworkError::Internal(format!(
            "failed to terminate {} active processes: {}",
            failures.len(),
            failures.join("; ")
        )))
    }

    #[cfg(test)]
    pub(crate) fn active_process_count(&self) -> Result<usize> {
        Ok(self.lock_active_processes()?.len())
    }

    fn register_active_process(
        &self,
        process_id: String,
        handle: ActiveProcessHandle,
    ) -> Result<()> {
        self.lock_active_processes()?.insert(process_id, handle);
        Ok(())
    }

    fn unregister_active_process(&self, process_id: &str) -> Result<()> {
        self.lock_active_processes()?.remove(process_id);
        Ok(())
    }

    fn lock_active_processes(
        &self,
    ) -> Result<MutexGuard<'_, HashMap<String, ActiveProcessHandle>>> {
        self.active_processes.lock().map_err(|_| {
            FrameworkError::Internal("active process registry lock poisoned".to_string())
        })
    }
}

fn wait_for_completion<S: ProcessEventSink>(
    child: Arc<Mutex<Child>>,
    stdout_pipe: Option<Box<dyn Read + Send>>,
    stderr_pipe: Option<Box<dyn Read + Send>>,
    job_id: &Option<String>,
    process_id: &str,
    command: &str,
    timeout_ms: Option<u64>,
    sink: &S,
) -> Result<(ExitStatus, String, String)> {
    let (sender, receiver) = mpsc::channel();
    let stdout_reader = stdout_pipe
        .map(|stdout| spawn_output_reader(stdout, ProcessOutputStream::Stdout, sender.clone()));
    let stderr_reader = stderr_pipe
        .map(|stderr| spawn_output_reader(stderr, ProcessOutputStream::Stderr, sender.clone()));
    drop(sender);

    let timeout = timeout_ms.map(Duration::from_millis);
    let started_at = Instant::now();
    let mut stdout = String::new();
    let mut stderr = String::new();

    loop {
        drain_output_events(
            &receiver,
            job_id,
            process_id,
            command,
            sink,
            &mut stdout,
            &mut stderr,
            true,
        )?;

        if let Some(status) = try_wait_child(&child)? {
            let reader_results = finish_output_readers(stdout_reader, stderr_reader)?;
            drain_output_events(
                &receiver,
                job_id,
                process_id,
                command,
                sink,
                &mut stdout,
                &mut stderr,
                false,
            )?;
            reader_results?;
            return Ok((status, stdout, stderr));
        }

        if let Some(timeout) = timeout {
            if started_at.elapsed() >= timeout {
                kill_child(&child)?;
                let _ = wait_child(&child);
                let reader_results = finish_output_readers(stdout_reader, stderr_reader)?;
                drain_output_events(
                    &receiver,
                    job_id,
                    process_id,
                    command,
                    sink,
                    &mut stdout,
                    &mut stderr,
                    false,
                )?;
                let _ = reader_results;
                return Err(FrameworkError::Timeout(format!(
                    "process timed out after {}ms: {}",
                    timeout.as_millis(),
                    command
                )));
            }
        }

        thread::sleep(Duration::from_millis(10));
    }
}

fn spawn_output_reader<T: Read + Send + 'static>(
    reader: T,
    stream: ProcessOutputStream,
    sender: mpsc::Sender<OutputMessage>,
) -> thread::JoinHandle<Result<()>> {
    thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buffer = Vec::new();

        loop {
            buffer.clear();
            let bytes_read = reader.read_until(b'\n', &mut buffer)?;
            if bytes_read == 0 {
                break;
            }

            let chunk = String::from_utf8_lossy(&buffer).into_owned();
            sender
                .send(OutputMessage {
                    stream: stream.clone(),
                    chunk,
                })
                .map_err(|_| {
                    FrameworkError::Internal("process output channel closed".to_string())
                })?;
        }

        Ok(())
    })
}

fn finish_output_readers(
    stdout_reader: Option<thread::JoinHandle<Result<()>>>,
    stderr_reader: Option<thread::JoinHandle<Result<()>>>,
) -> Result<Result<()>> {
    let stdout_result = join_output_reader(stdout_reader)?;
    let stderr_result = join_output_reader(stderr_reader)?;

    Ok(stdout_result.and(stderr_result))
}

fn join_output_reader(handle: Option<thread::JoinHandle<Result<()>>>) -> Result<Result<()>> {
    let Some(handle) = handle else {
        return Ok(Ok(()));
    };

    handle
        .join()
        .map_err(|_| FrameworkError::Internal("process output reader panicked".to_string()))
}

fn drain_output_events<S: ProcessEventSink>(
    receiver: &mpsc::Receiver<OutputMessage>,
    job_id: &Option<String>,
    process_id: &str,
    command: &str,
    sink: &S,
    stdout: &mut String,
    stderr: &mut String,
    wait_for_one: bool,
) -> Result<()> {
    if wait_for_one {
        match receiver.recv_timeout(Duration::from_millis(10)) {
            Ok(message) => {
                handle_output_message(message, job_id, process_id, command, sink, stdout, stderr)?
            }
            Err(mpsc::RecvTimeoutError::Timeout) => return Ok(()),
            Err(mpsc::RecvTimeoutError::Disconnected) => return Ok(()),
        }
    }

    while let Ok(message) = receiver.try_recv() {
        handle_output_message(message, job_id, process_id, command, sink, stdout, stderr)?;
    }

    Ok(())
}

fn handle_output_message<S: ProcessEventSink>(
    message: OutputMessage,
    job_id: &Option<String>,
    process_id: &str,
    command: &str,
    sink: &S,
    stdout: &mut String,
    stderr: &mut String,
) -> Result<()> {
    match message.stream {
        ProcessOutputStream::Stdout => stdout.push_str(&message.chunk),
        ProcessOutputStream::Stderr => stderr.push_str(&message.chunk),
    }

    sink.emit_process_output(ProcessOutputEvent {
        job_id: job_id.clone(),
        process_id: process_id.to_string(),
        command: command.to_string(),
        stream: message.stream,
        chunk: message.chunk,
    })
}

fn try_wait_child(child: &Arc<Mutex<Child>>) -> Result<Option<ExitStatus>> {
    let mut child = child
        .lock()
        .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
    child.try_wait().map_err(FrameworkError::from)
}

fn kill_child(child: &Arc<Mutex<Child>>) -> Result<()> {
    let mut child = child
        .lock()
        .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
    if child.try_wait()?.is_none() {
        child.kill()?;
    }

    Ok(())
}

fn wait_child(child: &Arc<Mutex<Child>>) -> Result<ExitStatus> {
    let mut child = child
        .lock()
        .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
    child.wait().map_err(FrameworkError::from)
}

fn force_terminate_handle(handle: &ActiveProcessHandle) -> Result<()> {
    handle.cancellation_requested.store(true, Ordering::Relaxed);
    let mut child = handle
        .child
        .lock()
        .map_err(|_| FrameworkError::Internal("active process lock poisoned".to_string()))?;
    if child.try_wait()?.is_none() {
        child.kill()?;
    }

    Ok(())
}

fn map_result(
    status: ExitStatus,
    process_id: &str,
    stdout: String,
    stderr: String,
    command: &str,
) -> Result<ProcessResult> {
    let exit_code = status.code();

    if status.success() {
        return Ok(ProcessResult {
            process_id: process_id.to_string(),
            stdout,
            stderr,
            exit_code,
        });
    }

    Err(FrameworkError::ProcessFailed {
        command: command.to_string(),
        exit_code,
        stderr_tail: trim_stderr(&stderr),
    })
}

fn next_process_id() -> String {
    format!(
        "process-{}",
        NEXT_PROCESS_ID.fetch_add(1, Ordering::Relaxed)
    )
}

fn trim_stderr(stderr: &str) -> String {
    const MAX_LEN: usize = 512;
    if stderr.len() <= MAX_LEN {
        return stderr.to_string();
    }

    stderr[stderr.len() - MAX_LEN..].to_string()
}

#[cfg(test)]
mod tests {
    use super::{ProcessEventSink, ProcessOutputEvent, ProcessOutputStream, ProcessRuntime};
    use crate::framework::{FrameworkError, Result};
    use std::{
        sync::{Arc, Mutex},
        time::Duration,
    };

    #[derive(Clone, Default)]
    struct TestProcessEventSink {
        events: Arc<Mutex<Vec<ProcessOutputEvent>>>,
    }

    impl TestProcessEventSink {
        fn emitted(&self) -> Vec<ProcessOutputEvent> {
            self.events.lock().expect("event lock").clone()
        }
    }

    impl ProcessEventSink for TestProcessEventSink {
        fn emit_process_output(&self, payload: ProcessOutputEvent) -> Result<()> {
            self.events.lock().expect("event lock").push(payload);
            Ok(())
        }
    }

    #[test]
    fn process_runtime_hides_gui_child_process_console_windows() {
        let production_source = include_str!("runtime.rs")
            .split("mod tests {")
            .next()
            .expect("production source");

        assert!(
            production_source.contains("configure_hidden_child_process(&mut process);"),
            "desktop GUI process execution must apply the shared hidden-child-process policy before spawning shell commands"
        );
    }

    #[test]
    fn runs_controlled_process_and_captures_stdout() {
        let runtime = ProcessRuntime::new();
        let result = runtime
            .run_with_sink(
                test_echo_request(),
                None,
                None,
                true,
                &TestProcessEventSink::default(),
                |_| Ok(()),
            )
            .expect("process result");

        assert!(result.stdout.contains("desktop-kernel"));
        assert_eq!(result.exit_code, Some(0));
        assert!(result.process_id.starts_with("process-"));
    }

    #[test]
    fn emits_stdout_events_with_matching_process_id() {
        let runtime = ProcessRuntime::new();
        let sink = TestProcessEventSink::default();

        let result = runtime
            .run_with_sink(test_echo_request(), None, None, true, &sink, |_| Ok(()))
            .expect("process result");
        let events = sink.emitted();

        assert!(!events.is_empty());
        assert!(events
            .iter()
            .any(|event| event.stream == ProcessOutputStream::Stdout));
        assert!(events
            .iter()
            .any(|event| event.chunk.contains("desktop-kernel")));
        assert!(events
            .iter()
            .all(|event| event.process_id == result.process_id));
        assert!(events.iter().all(|event| event.job_id.is_none()));
    }

    #[test]
    fn times_out_long_running_processes() {
        let runtime = ProcessRuntime::new();
        let error = runtime
            .run_with_sink(
                test_sleep_request(50),
                None,
                None,
                true,
                &TestProcessEventSink::default(),
                |_| Ok(()),
            )
            .expect_err("process should time out");

        match error {
            FrameworkError::Timeout(message) => {
                assert!(message.contains("timed out"));
            }
            other => panic!("expected timeout error, got {other}"),
        }
    }

    #[test]
    fn cancel_all_terminates_active_processes() {
        let runtime = ProcessRuntime::new();
        let running_runtime = runtime.clone();

        let handle = std::thread::spawn(move || {
            running_runtime.run_with_sink(
                test_sleep_request(5_000),
                Some("process-under-test".to_string()),
                None,
                true,
                &TestProcessEventSink::default(),
                |_| Ok(()),
            )
        });

        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while runtime
            .active_process_count()
            .expect("active process count")
            == 0
        {
            assert!(
                std::time::Instant::now() < deadline,
                "process did not register as active in time"
            );
            std::thread::sleep(Duration::from_millis(10));
        }

        runtime.cancel_all().expect("cancel all");

        let error = handle
            .join()
            .expect("background process thread")
            .expect_err("process should be cancelled");

        match error {
            FrameworkError::Cancelled(message) => {
                assert!(message.contains("process cancelled"));
            }
            other => panic!("expected cancellation error, got {other}"),
        }

        assert_eq!(
            runtime
                .active_process_count()
                .expect("active process count"),
            0
        );
    }

    #[cfg(windows)]
    fn test_echo_request() -> super::ValidatedProcessRequest {
        super::ValidatedProcessRequest {
            command: "cmd".to_string(),
            args: vec!["/C".to_string(), "echo desktop-kernel".to_string()],
            cwd: std::env::current_dir().expect("current dir"),
            timeout_ms: None,
            env: std::env::vars_os().collect(),
        }
    }

    #[cfg(windows)]
    fn test_sleep_request(timeout_ms: u64) -> super::ValidatedProcessRequest {
        super::ValidatedProcessRequest {
            command: "powershell".to_string(),
            args: vec![
                "-NoLogo".to_string(),
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                "Start-Sleep -Seconds 2".to_string(),
            ],
            cwd: std::env::current_dir().expect("current dir"),
            timeout_ms: Some(timeout_ms),
            env: std::env::vars_os().collect(),
        }
    }

    #[cfg(not(windows))]
    fn test_echo_request() -> super::ValidatedProcessRequest {
        super::ValidatedProcessRequest {
            command: "sh".to_string(),
            args: vec!["-c".to_string(), "printf desktop-kernel".to_string()],
            cwd: std::env::current_dir().expect("current dir"),
            timeout_ms: None,
            env: std::env::vars_os().collect(),
        }
    }

    #[cfg(not(windows))]
    fn test_sleep_request(timeout_ms: u64) -> super::ValidatedProcessRequest {
        super::ValidatedProcessRequest {
            command: "sh".to_string(),
            args: vec!["-c".to_string(), "sleep 2".to_string()],
            cwd: std::env::current_dir().expect("current dir"),
            timeout_ms: Some(timeout_ms),
            env: std::env::vars_os().collect(),
        }
    }
}
