mod profiles;
mod requests;
mod runtime;

pub use self::profiles::ProcessProfile;
pub use self::requests::ProcessRequest;
#[allow(unused_imports)]
pub use self::runtime::{ProcessEventSink, ProcessOutputEvent, ProcessOutputStream, ProcessResult};

use self::{
    profiles::{
        available_profiles as available_process_profiles,
        resolve_profile as resolve_process_profile,
    },
    requests::{prepare_execution_request, prepare_request},
    runtime::{NoopProcessEventSink, ProcessRuntime},
};
use crate::framework::{
    config::AppConfig,
    kernel::DesktopProcessInfo,
    paths::AppPaths,
    policy::ExecutionPolicy,
    services::openclaw_runtime::ActivatedOpenClawRuntime,
    Result,
};

#[derive(Clone, Debug)]
pub struct ProcessService {
    policy: ExecutionPolicy,
    runtime: ProcessRuntime,
}

impl ProcessService {
    pub fn new(policy: ExecutionPolicy) -> Self {
        Self {
            policy,
            runtime: ProcessRuntime::new(),
        }
    }

    #[allow(dead_code)]
    pub fn run_capture(&self, request: ProcessRequest) -> Result<ProcessResult> {
        self.run_capture_with_sink(request, &NoopProcessEventSink)
    }

    pub fn run_capture_and_emit<S: ProcessEventSink>(
        &self,
        request: ProcessRequest,
        sink: &S,
    ) -> Result<ProcessResult> {
        self.run_capture_with_sink(request, sink)
    }

    pub fn resolve_profile(&self, profile_id: &str) -> Result<ProcessProfile> {
        resolve_process_profile(profile_id)
    }

    #[allow(dead_code)]
    pub fn run_profile_and_emit<S: ProcessEventSink>(
        &self,
        profile_id: &str,
        job_id: Option<String>,
        process_id: Option<String>,
        sink: &S,
    ) -> Result<ProcessResult> {
        self.run_profile_and_emit_with_started(profile_id, job_id, process_id, sink, |_| Ok(()))
    }

    pub fn run_profile_and_emit_with_started<S, F>(
        &self,
        profile_id: &str,
        job_id: Option<String>,
        process_id: Option<String>,
        sink: &S,
        on_started: F,
    ) -> Result<ProcessResult>
    where
        S: ProcessEventSink,
        F: FnOnce(&str) -> Result<()>,
    {
        let profile = self.resolve_profile(profile_id)?;
        let validated = prepare_execution_request(&self.policy, profile.to_request())?;

        self.runtime.run_with_sink(
            validated,
            process_id,
            job_id,
            profile.allow_cancellation(),
            sink,
            on_started,
        )
    }

    pub fn run_managed_openclaw_profile_and_emit_with_started<S, F>(
        &self,
        paths: &AppPaths,
        openclaw_runtime: &ActivatedOpenClawRuntime,
        profile_id: &str,
        job_id: Option<String>,
        process_id: Option<String>,
        sink: &S,
        on_started: F,
    ) -> Result<ProcessResult>
    where
        S: ProcessEventSink,
        F: FnOnce(&str) -> Result<()>,
    {
        let profile = self.resolve_profile(profile_id)?;
        let request = profile.to_request_for_managed_openclaw_runtime(paths, openclaw_runtime)?;
        let validated = prepare_execution_request(&self.policy, request)?;

        self.runtime.run_with_sink(
            validated,
            process_id,
            job_id,
            profile.allow_cancellation(),
            sink,
            on_started,
        )
    }

    pub fn cancel(&self, process_id: &str) -> Result<()> {
        self.runtime.cancel(process_id)
    }

    pub fn cancel_all(&self) -> Result<()> {
        self.runtime.cancel_all()
    }

    pub fn available_profiles(&self) -> Vec<ProcessProfile> {
        available_process_profiles()
    }

    pub fn kernel_info(
        &self,
        config: &AppConfig,
        active_job_count: usize,
        active_process_job_count: usize,
    ) -> Result<DesktopProcessInfo> {
        Ok(DesktopProcessInfo {
            default_timeout_ms: config.process.default_timeout_ms,
            max_concurrent_jobs: config.process.max_concurrent_jobs,
            active_job_count,
            active_process_job_count,
            available_profiles: self
                .available_profiles()
                .into_iter()
                .map(|profile| profile.to_kernel_info())
                .collect(),
        })
    }

    fn run_capture_with_sink<S: ProcessEventSink>(
        &self,
        request: ProcessRequest,
        sink: &S,
    ) -> Result<ProcessResult> {
        let validated = prepare_request(&self.policy, request)?;
        self.runtime
            .run_with_sink(validated, None, None, true, sink, |_| Ok(()))
    }
}

#[cfg(test)]
mod tests {
    use super::{ProcessEventSink, ProcessOutputEvent, ProcessService};
    use crate::framework::{paths::resolve_paths_for_root, policy::ExecutionPolicy, Result};
    use std::sync::{Arc, Mutex};

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
    fn emits_process_events_with_job_id_when_supplied() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));
        let sink = TestProcessEventSink::default();

        let result = service
            .run_profile_and_emit(
                "diagnostics.echo",
                Some("job-123".to_string()),
                Some("process-777".to_string()),
                &sink,
            )
            .expect("process result");
        let events = sink.emitted();

        assert_eq!(result.process_id, "process-777");
        assert!(events
            .iter()
            .any(|event| event.job_id.as_deref() == Some("job-123")));
        assert!(events.iter().all(|event| event.process_id == "process-777"));
    }
}
