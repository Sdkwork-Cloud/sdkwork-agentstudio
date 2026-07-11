use crate::framework::FrameworkError;
use crate::framework::Result;

pub fn run_blocking<T, F>(label: &'static str, task: F) -> Result<T>
where
    F: FnOnce() -> Result<T>,
{
    let _ = label;
    task()
}

pub async fn run_blocking_async<T, F>(label: &'static str, task: F) -> Result<T>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T> + Send + 'static,
{
    tokio::task::spawn_blocking(task)
        .await
        .map_err(|error| FrameworkError::Internal(format!("{label} join error: {error}")))?
}

#[cfg(test)]
mod tests {
    #[test]
    fn run_blocking_returns_task_result() {
        let value = super::run_blocking("echo", || Ok::<_, crate::framework::FrameworkError>(41))
            .expect("blocking result");

        assert_eq!(value, 41);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn run_blocking_async_moves_work_off_the_async_caller_thread() {
        let caller_thread = std::thread::current().id();

        let worker_thread = super::run_blocking_async("echo", move || {
            Ok::<_, crate::framework::FrameworkError>(std::thread::current().id())
        })
        .await
        .expect("blocking result");

        assert_ne!(caller_thread, worker_thread);
    }
}
