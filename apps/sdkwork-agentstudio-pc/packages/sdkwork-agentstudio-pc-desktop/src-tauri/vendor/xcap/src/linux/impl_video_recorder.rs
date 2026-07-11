use std::sync::mpsc::Receiver;

use crate::{video_recorder::Frame, XCapError, XCapResult};

use super::impl_monitor::ImplMonitor;

#[derive(Debug, Clone)]
pub enum ImplVideoRecorder {}

impl ImplVideoRecorder {
    pub fn new(_monitor: ImplMonitor) -> XCapResult<(Self, Receiver<Frame>)> {
        Err(XCapError::NotSupported)
    }

    pub fn start(&self) -> XCapResult<()> {
        match *self {}
    }

    pub fn stop(&self) -> XCapResult<()> {
        match *self {}
    }
}
