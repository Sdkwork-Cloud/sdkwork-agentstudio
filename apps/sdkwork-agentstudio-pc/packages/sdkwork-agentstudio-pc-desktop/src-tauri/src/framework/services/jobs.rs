use crate::framework::{
    events,
    paths::AppPaths,
    services::{
        openclaw_runtime::ActivatedOpenClawRuntime,
        process::{ProcessEventSink, ProcessService},
    },
    FrameworkError, Result,
};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex, MutexGuard,
    },
    thread,
};
use tauri::{AppHandle, Emitter, Runtime};

static NEXT_JOB_ID: AtomicU64 = AtomicU64::new(1);

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobState {
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
    pub id: String,
    pub kind: String,
    pub state: JobState,
    pub stage: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobUpdateEvent {
    pub record: JobRecord,
}

pub trait JobEventSink {
    fn emit_job_updated(&self, payload: JobUpdateEvent) -> Result<()>;
}

impl<R: Runtime> JobEventSink for AppHandle<R> {
    fn emit_job_updated(&self, payload: JobUpdateEvent) -> Result<()> {
        self.emit(events::JOB_UPDATED, payload)
            .map_err(FrameworkError::from)
    }
}

#[derive(Clone, Debug)]
pub struct JobService {
    jobs: Arc<Mutex<HashMap<String, JobRecord>>>,
    max_concurrent_process_jobs: usize,
}

impl JobService {
    pub fn new() -> Self {
        Self::with_max_concurrent_process_jobs(u32::MAX)
    }

    pub fn with_max_concurrent_process_jobs(max_concurrent_process_jobs: u32) -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            max_concurrent_process_jobs: max_concurrent_process_jobs as usize,
        }
    }

    pub fn submit(&self, kind: &str) -> Result<String> {
        self.submit_with_metadata(kind, None)
    }

    pub fn submit_process_and_emit<S>(
        &self,
        process_service: ProcessService,
        profile_id: &str,
        sink: S,
    ) -> Result<String>
    where
        S: JobEventSink + ProcessEventSink + Clone + Send + 'static,
    {
        let profile = process_service.resolve_profile(profile_id)?;
        let job_id = self.submit_process_with_metadata(&profile.job_kind, profile.id.clone())?;
        let queued = self.get(&job_id)?;
        emit_job_updated(&sink, &queued)?;

        let jobs = self.clone();
        let background_job_id = job_id.clone();
        thread::spawn(move || {
            let result = process_service.run_profile_and_emit_with_started(
                &profile.id,
                Some(background_job_id.clone()),
                None,
                &sink,
                |process_id| {
                    jobs.mark_running_process_and_emit(
                        &background_job_id,
                        "running",
                        queued.profile_id.clone(),
                        process_id.to_string(),
                        &sink,
                    )
                    .map(|_| ())
                },
            );
            let current = jobs.get(&background_job_id);

            if matches!(
                current.as_ref().map(|record| &record.state),
                Ok(JobState::Cancelled)
            ) {
                return;
            }

            match result {
                Ok(_) => {
                    let _ = jobs.mark_succeeded_and_emit(&background_job_id, "completed", &sink);
                }
                Err(FrameworkError::Cancelled(_)) => {
                    let _ = jobs.cancel_and_emit(&background_job_id, &sink);
                }
                Err(error) => {
                    let _ = jobs.mark_failed_and_emit(
                        &background_job_id,
                        &format!("process failed: {error}"),
                        &sink,
                    );
                }
            }
        });

        Ok(job_id)
    }

    pub fn submit_managed_openclaw_process_and_emit<S>(
        &self,
        process_service: ProcessService,
        paths: AppPaths,
        openclaw_runtime: ActivatedOpenClawRuntime,
        profile_id: &str,
        sink: S,
    ) -> Result<String>
    where
        S: JobEventSink + ProcessEventSink + Clone + Send + 'static,
    {
        let profile = process_service.resolve_profile(profile_id)?;
        let job_id = self.submit_process_with_metadata(&profile.job_kind, profile.id.clone())?;
        let queued = self.get(&job_id)?;
        emit_job_updated(&sink, &queued)?;

        let jobs = self.clone();
        let background_job_id = job_id.clone();
        thread::spawn(move || {
            let result = process_service.run_managed_openclaw_profile_and_emit_with_started(
                &paths,
                &openclaw_runtime,
                &profile.id,
                Some(background_job_id.clone()),
                None,
                &sink,
                |process_id| {
                    jobs.mark_running_process_and_emit(
                        &background_job_id,
                        "running",
                        queued.profile_id.clone(),
                        process_id.to_string(),
                        &sink,
                    )
                    .map(|_| ())
                },
            );
            let current = jobs.get(&background_job_id);

            if matches!(
                current.as_ref().map(|record| &record.state),
                Ok(JobState::Cancelled)
            ) {
                return;
            }

            match result {
                Ok(_) => {
                    let _ = jobs.mark_succeeded_and_emit(&background_job_id, "completed", &sink);
                }
                Err(FrameworkError::Cancelled(_)) => {
                    let _ = jobs.cancel_and_emit(&background_job_id, &sink);
                }
                Err(error) => {
                    let _ = jobs.mark_failed_and_emit(
                        &background_job_id,
                        &format!("process failed: {error}"),
                        &sink,
                    );
                }
            }
        });

        Ok(job_id)
    }

    fn submit_with_metadata(&self, kind: &str, profile_id: Option<String>) -> Result<String> {
        let record = build_job_record(kind, profile_id)?;
        let id = record.id.clone();
        self.lock_jobs()?.insert(id.clone(), record);
        Ok(id)
    }

    fn submit_process_with_metadata(&self, kind: &str, profile_id: String) -> Result<String> {
        let record = build_job_record(kind, Some(profile_id))?;
        let id = record.id.clone();
        let mut jobs = self.lock_jobs()?;
        let active_process_jobs = jobs
            .values()
            .filter(|record| is_active_process_job(record))
            .count();

        if active_process_jobs >= self.max_concurrent_process_jobs {
            return Err(FrameworkError::Conflict(format!(
                "max concurrent process jobs reached: {}",
                self.max_concurrent_process_jobs
            )));
        }

        jobs.insert(id.clone(), record);
        Ok(id)
    }

    pub fn submit_and_emit<S: JobEventSink>(&self, kind: &str, sink: &S) -> Result<String> {
        let id = self.submit(kind)?;
        let record = self.get(&id)?;
        emit_job_updated(sink, &record)?;
        Ok(id)
    }

    pub fn get(&self, id: &str) -> Result<JobRecord> {
        self.lock_jobs()?
            .get(id)
            .cloned()
            .ok_or_else(|| FrameworkError::NotFound(format!("job not found: {id}")))
    }

    pub fn list(&self) -> Result<Vec<JobRecord>> {
        let mut jobs = self.lock_jobs()?.values().cloned().collect::<Vec<_>>();
        jobs.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(jobs)
    }

    pub fn active_job_count(&self) -> Result<usize> {
        Ok(self
            .lock_jobs()?
            .values()
            .filter(|record| matches!(record.state, JobState::Queued | JobState::Running))
            .count())
    }

    pub fn active_process_job_count(&self) -> Result<usize> {
        Ok(self
            .lock_jobs()?
            .values()
            .filter(|record| is_active_process_job(record))
            .count())
    }

    #[allow(dead_code)]
    pub fn mark_running(&self, id: &str, stage: &str) -> Result<JobRecord> {
        self.transition(id, JobState::Running, stage)
    }

    pub fn mark_running_process_and_emit<S: JobEventSink>(
        &self,
        id: &str,
        stage: &str,
        profile_id: Option<String>,
        process_id: String,
        sink: &S,
    ) -> Result<JobRecord> {
        let record = self.mark_running_process(id, stage, profile_id, process_id)?;
        emit_job_updated(sink, &record)?;
        Ok(record)
    }

    pub fn mark_running_process(
        &self,
        id: &str,
        stage: &str,
        profile_id: Option<String>,
        process_id: String,
    ) -> Result<JobRecord> {
        let mut jobs = self.lock_jobs()?;
        let record = jobs
            .get_mut(id)
            .ok_or_else(|| FrameworkError::NotFound(format!("job not found: {id}")))?;

        if matches!(
            record.state,
            JobState::Succeeded | JobState::Failed | JobState::Cancelled
        ) {
            return Err(FrameworkError::Conflict(format!(
                "cannot transition terminal job {} from {:?}",
                record.id, record.state
            )));
        }

        record.state = JobState::Running;
        record.stage = stage.trim().to_string();
        record.profile_id = profile_id;
        record.process_id = Some(process_id);
        Ok(record.clone())
    }

    #[allow(dead_code)]
    pub fn mark_running_and_emit<S: JobEventSink>(
        &self,
        id: &str,
        stage: &str,
        sink: &S,
    ) -> Result<JobRecord> {
        let record = self.mark_running(id, stage)?;
        emit_job_updated(sink, &record)?;
        Ok(record)
    }

    #[allow(dead_code)]
    pub fn mark_succeeded(&self, id: &str, stage: &str) -> Result<JobRecord> {
        self.transition(id, JobState::Succeeded, stage)
    }

    #[allow(dead_code)]
    pub fn mark_succeeded_and_emit<S: JobEventSink>(
        &self,
        id: &str,
        stage: &str,
        sink: &S,
    ) -> Result<JobRecord> {
        let record = self.mark_succeeded(id, stage)?;
        emit_job_updated(sink, &record)?;
        Ok(record)
    }

    #[allow(dead_code)]
    pub fn mark_failed(&self, id: &str, stage: &str) -> Result<JobRecord> {
        self.transition(id, JobState::Failed, stage)
    }

    #[allow(dead_code)]
    pub fn mark_failed_and_emit<S: JobEventSink>(
        &self,
        id: &str,
        stage: &str,
        sink: &S,
    ) -> Result<JobRecord> {
        let record = self.mark_failed(id, stage)?;
        emit_job_updated(sink, &record)?;
        Ok(record)
    }

    pub fn cancel(&self, id: &str) -> Result<JobRecord> {
        self.transition(id, JobState::Cancelled, "cancelled")
    }

    pub fn cancel_and_emit<S: JobEventSink>(&self, id: &str, sink: &S) -> Result<JobRecord> {
        let record = self.cancel(id)?;
        emit_job_updated(sink, &record)?;
        Ok(record)
    }

    fn transition(&self, id: &str, state: JobState, stage: &str) -> Result<JobRecord> {
        let mut jobs = self.lock_jobs()?;
        let record = jobs
            .get_mut(id)
            .ok_or_else(|| FrameworkError::NotFound(format!("job not found: {id}")))?;

        if matches!(
            record.state,
            JobState::Succeeded | JobState::Failed | JobState::Cancelled
        ) {
            return Err(FrameworkError::Conflict(format!(
                "cannot transition terminal job {} from {:?}",
                record.id, record.state
            )));
        }

        record.state = state;
        record.stage = stage.trim().to_string();
        Ok(record.clone())
    }

    fn lock_jobs(&self) -> Result<MutexGuard<'_, HashMap<String, JobRecord>>> {
        self.jobs
            .lock()
            .map_err(|_| FrameworkError::Internal("job store lock poisoned".to_string()))
    }
}

impl Default for JobService {
    fn default() -> Self {
        Self::new()
    }
}

fn emit_job_updated<S: JobEventSink>(sink: &S, record: &JobRecord) -> Result<()> {
    sink.emit_job_updated(JobUpdateEvent {
        record: record.clone(),
    })
}

fn build_job_record(kind: &str, profile_id: Option<String>) -> Result<JobRecord> {
    let normalized_kind = kind.trim();
    if normalized_kind.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "job kind must not be empty".to_string(),
        ));
    }

    let id = format!("job-{}", NEXT_JOB_ID.fetch_add(1, Ordering::Relaxed));

    Ok(JobRecord {
        id,
        kind: normalized_kind.to_string(),
        state: JobState::Queued,
        stage: "queued".to_string(),
        profile_id,
        process_id: None,
    })
}

fn is_active_process_job(record: &JobRecord) -> bool {
    record.profile_id.is_some() && matches!(record.state, JobState::Queued | JobState::Running)
}

#[cfg(test)]
mod tests {
    use super::{JobEventSink, JobRecord, JobService, JobState, JobUpdateEvent};
    use crate::framework::{
        paths::resolve_paths_for_root,
        policy::ExecutionPolicy,
        services::process::{ProcessEventSink, ProcessOutputEvent, ProcessService},
        Result,
    };
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    #[derive(Clone, Default)]
    struct TestEventSink {
        job_events: Arc<Mutex<Vec<JobUpdateEvent>>>,
        process_events: Arc<Mutex<Vec<ProcessOutputEvent>>>,
    }

    impl TestEventSink {
        fn job_updates(&self) -> Vec<JobUpdateEvent> {
            self.job_events.lock().expect("event lock").clone()
        }

        fn process_updates(&self) -> Vec<ProcessOutputEvent> {
            self.process_events.lock().expect("event lock").clone()
        }
    }

    impl JobEventSink for TestEventSink {
        fn emit_job_updated(&self, payload: JobUpdateEvent) -> Result<()> {
            self.job_events.lock().expect("event lock").push(payload);
            Ok(())
        }
    }

    impl ProcessEventSink for TestEventSink {
        fn emit_process_output(&self, payload: ProcessOutputEvent) -> Result<()> {
            self.process_events
                .lock()
                .expect("event lock")
                .push(payload);
            Ok(())
        }
    }

    #[test]
    fn job_service_tracks_lifecycle_transitions() {
        let jobs = JobService::new();
        let id = jobs.submit("process.spawn").expect("job id");

        assert_eq!(jobs.get(&id).expect("queued").state, JobState::Queued);

        jobs.mark_running(&id, "starting").expect("running");
        assert_eq!(jobs.get(&id).expect("running").state, JobState::Running);

        jobs.cancel(&id).expect("cancel");
        assert_eq!(jobs.get(&id).expect("cancelled").state, JobState::Cancelled);
    }

    #[test]
    fn job_service_marks_jobs_succeeded() {
        let jobs = JobService::new();
        let id = jobs.submit("process.spawn").expect("job id");
        jobs.mark_running(&id, "running").expect("running");

        let record = jobs.mark_succeeded(&id, "finished").expect("succeeded");

        assert_eq!(record.state, JobState::Succeeded);
        assert_eq!(record.stage, "finished");
    }

    #[test]
    fn job_service_marks_jobs_failed() {
        let jobs = JobService::new();
        let id = jobs.submit("process.spawn").expect("job id");
        jobs.mark_running(&id, "running").expect("running");

        let record = jobs.mark_failed(&id, "process failed").expect("failed");

        assert_eq!(record.state, JobState::Failed);
        assert_eq!(record.stage, "process failed");
    }

    #[test]
    fn submit_and_cancel_emit_job_updates() {
        let jobs = JobService::new();
        let sink = TestEventSink::default();

        let id = jobs
            .submit_and_emit("process.spawn", &sink)
            .expect("job submission");
        let cancelled = jobs.cancel_and_emit(&id, &sink).expect("job cancellation");

        let events = sink.job_updates();

        assert_eq!(events.len(), 2);
        assert_eq!(
            events[0].record,
            JobRecord {
                id: id.clone(),
                kind: "process.spawn".to_string(),
                state: JobState::Queued,
                stage: "queued".to_string(),
                profile_id: None,
                process_id: None,
            }
        );
        assert_eq!(events[1].record, cancelled);
        assert_eq!(events[1].record.state, JobState::Cancelled);
    }

    #[test]
    fn process_job_orchestration_completes_with_profile_and_process_ids() {
        let jobs = JobService::new();
        let (_root, process) = test_process_service();
        let sink = TestEventSink::default();

        let job_id = jobs
            .submit_process_and_emit(process, "diagnostics.echo", sink.clone())
            .expect("process job");

        let record = wait_for_terminal_state(&jobs, &job_id);

        assert_eq!(record.state, JobState::Succeeded);
        assert_eq!(record.profile_id.as_deref(), Some("diagnostics.echo"));
        assert!(record
            .process_id
            .as_deref()
            .is_some_and(|value| value.starts_with("process-")));
        assert!(sink
            .process_updates()
            .iter()
            .any(|event| event.job_id.as_deref() == Some(job_id.as_str())));
    }

    #[test]
    fn process_job_cancellation_stops_running_job() {
        let jobs = JobService::new();
        let (_root, process) = test_process_service();
        let sink = TestEventSink::default();

        let job_id = jobs
            .submit_process_and_emit(process.clone(), "diagnostics.wait", sink.clone())
            .expect("process job");

        wait_for_running_state(&jobs, &job_id);
        let running = jobs.get(&job_id).expect("running job");
        let process_id = running.process_id.expect("process id");

        process.cancel(&process_id).expect("cancel process");
        let cancelled = jobs.cancel_and_emit(&job_id, &sink).expect("cancel job");

        assert_eq!(cancelled.state, JobState::Cancelled);
        assert_eq!(
            wait_for_terminal_state(&jobs, &job_id).state,
            JobState::Cancelled
        );
    }

    #[test]
    fn rejects_unknown_process_profiles() {
        let jobs = JobService::new();
        let (_root, process) = test_process_service();
        let sink = TestEventSink::default();

        let error = jobs
            .submit_process_and_emit(process, "missing.profile", sink)
            .expect_err("unknown profile");

        assert!(error.to_string().contains("process profile not found"));
    }

    #[test]
    fn rejects_process_submission_when_max_concurrent_jobs_is_reached() {
        let jobs = JobService::with_max_concurrent_process_jobs(1);
        let (_root, process) = test_process_service();
        let sink = TestEventSink::default();

        let first_job_id = jobs
            .submit_process_and_emit(process.clone(), "diagnostics.wait", sink.clone())
            .expect("first process job");

        assert_eq!(
            jobs.active_process_job_count()
                .expect("active process job count"),
            1
        );

        let error = jobs
            .submit_process_and_emit(process.clone(), "diagnostics.wait", sink)
            .expect_err("process budget should be enforced");

        assert!(error
            .to_string()
            .contains("max concurrent process jobs reached"));

        wait_for_running_state(&jobs, &first_job_id);
        let running = jobs.get(&first_job_id).expect("running job");
        let process_id = running.process_id.expect("process id");
        process.cancel(&process_id).expect("cancel process");
        jobs.cancel(&first_job_id).expect("cancel job");
    }

    fn test_process_service() -> (tempfile::TempDir, ProcessService) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = ProcessService::new(ExecutionPolicy::for_paths(&paths).expect("policy"));
        (root, service)
    }

    fn wait_for_running_state(jobs: &JobService, job_id: &str) {
        let deadline = Instant::now() + Duration::from_secs(3);
        loop {
            let record = jobs.get(job_id).expect("job record");
            if record.state == JobState::Running {
                return;
            }
            assert!(
                Instant::now() < deadline,
                "job did not reach running state in time"
            );
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    fn wait_for_terminal_state(jobs: &JobService, job_id: &str) -> JobRecord {
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let record = jobs.get(job_id).expect("job record");
            if matches!(
                record.state,
                JobState::Succeeded | JobState::Failed | JobState::Cancelled
            ) {
                return record;
            }
            assert!(
                Instant::now() < deadline,
                "job did not reach terminal state in time"
            );
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}
