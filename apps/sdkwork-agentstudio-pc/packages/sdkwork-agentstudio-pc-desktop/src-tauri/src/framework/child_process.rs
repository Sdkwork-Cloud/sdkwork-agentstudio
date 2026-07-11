use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(unix)]
use std::{io, os::unix::process::CommandExt};

#[cfg(windows)]
pub(crate) const WINDOWS_CREATE_NO_WINDOW: u32 = 0x0800_0000;
#[cfg(windows)]
pub(crate) const WINDOWS_CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

pub(crate) fn configure_hidden_child_process(command: &mut Command) {
    #[cfg(windows)]
    {
        command.creation_flags(hidden_child_process_creation_flags());
    }
}

pub(crate) fn configure_managed_child_process(command: &mut Command) {
    #[cfg(windows)]
    {
        command.creation_flags(managed_child_process_creation_flags());
    }

    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }
}

#[cfg(windows)]
pub(crate) fn hidden_child_process_creation_flags() -> u32 {
    WINDOWS_CREATE_NO_WINDOW
}

#[cfg(windows)]
pub(crate) fn managed_child_process_creation_flags() -> u32 {
    WINDOWS_CREATE_NEW_PROCESS_GROUP | WINDOWS_CREATE_NO_WINDOW
}

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    use super::{
        hidden_child_process_creation_flags, managed_child_process_creation_flags,
        WINDOWS_CREATE_NEW_PROCESS_GROUP, WINDOWS_CREATE_NO_WINDOW,
    };

    #[cfg(windows)]
    #[test]
    fn hidden_child_process_flags_hide_console_windows() {
        assert_eq!(
            hidden_child_process_creation_flags(),
            WINDOWS_CREATE_NO_WINDOW
        );
    }

    #[cfg(windows)]
    #[test]
    fn managed_child_process_flags_hide_console_windows_and_create_process_group() {
        assert_eq!(
            managed_child_process_creation_flags(),
            WINDOWS_CREATE_NEW_PROCESS_GROUP | WINDOWS_CREATE_NO_WINDOW
        );
    }
}
