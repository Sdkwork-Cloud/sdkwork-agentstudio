use std::{ffi::OsString, path::PathBuf};

use clap::{Args, Parser, Subcommand, ValueEnum};

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ClawServerRunArgs {
    pub config_path: Option<PathBuf>,
    pub host: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ClawServerPrintConfigArgs {
    pub config_path: Option<PathBuf>,
    pub host: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum ClawServerServicePlatform {
    Linux,
    Macos,
    Windows,
}

impl ClawServerServicePlatform {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Linux => "linux",
            Self::Macos => "macos",
            Self::Windows => "windows",
        }
    }

    pub fn manager_kind(self) -> &'static str {
        match self {
            Self::Linux => "systemd",
            Self::Macos => "launchd",
            Self::Windows => "windowsService",
        }
    }

    pub fn default_current() -> Self {
        match std::env::consts::OS {
            "windows" => Self::Windows,
            "macos" => Self::Macos,
            _ => Self::Linux,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClawServerServicePrintManifestArgs {
    pub platform: ClawServerServicePlatform,
    pub config_path: Option<PathBuf>,
    pub host: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClawServerServiceLifecycleArgs {
    pub platform: ClawServerServicePlatform,
    pub config_path: Option<PathBuf>,
    pub host: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClawServerServiceCommand {
    PrintManifest(ClawServerServicePrintManifestArgs),
    Install(ClawServerServiceLifecycleArgs),
    Start(ClawServerServiceLifecycleArgs),
    Stop(ClawServerServiceLifecycleArgs),
    Restart(ClawServerServiceLifecycleArgs),
    Status(ClawServerServiceLifecycleArgs),
}

impl ClawServerServiceCommand {
    fn shared_args(&self) -> ServiceSharedArgsRef<'_> {
        match self {
            Self::PrintManifest(args) => ServiceSharedArgsRef {
                config_path: args.config_path.as_ref(),
                host: args.host.as_deref(),
                port: args.port,
            },
            Self::Install(args)
            | Self::Start(args)
            | Self::Stop(args)
            | Self::Restart(args)
            | Self::Status(args) => ServiceSharedArgsRef {
                config_path: args.config_path.as_ref(),
                host: args.host.as_deref(),
                port: args.port,
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClawServerCliCommand {
    Run(ClawServerRunArgs),
    PrintConfig(ClawServerPrintConfigArgs),
    Service(ClawServerServiceCommand),
}

impl ClawServerCliCommand {
    pub fn config_path(&self) -> Option<&PathBuf> {
        match self {
            Self::Run(args) => args.config_path.as_ref(),
            Self::PrintConfig(args) => args.config_path.as_ref(),
            Self::Service(args) => args.shared_args().config_path,
        }
    }

    pub fn host_override(&self) -> Option<&str> {
        match self {
            Self::Run(args) => args.host.as_deref(),
            Self::PrintConfig(args) => args.host.as_deref(),
            Self::Service(args) => args.shared_args().host,
        }
    }

    pub fn port_override(&self) -> Option<u16> {
        match self {
            Self::Run(args) => args.port,
            Self::PrintConfig(args) => args.port,
            Self::Service(args) => args.shared_args().port,
        }
    }
}

struct ServiceSharedArgsRef<'a> {
    config_path: Option<&'a PathBuf>,
    host: Option<&'a str>,
    port: Option<u16>,
}

#[derive(Debug, Clone, Args, PartialEq, Eq, Default)]
struct SharedOverrideArgs {
    #[arg(long = "config", value_name = "PATH")]
    config_path: Option<PathBuf>,
    #[arg(long = "host")]
    host: Option<String>,
    #[arg(long = "port")]
    port: Option<u16>,
}

#[derive(Debug, Parser)]
#[command(name = "claw-server")]
struct RawClawServerCli {
    #[command(flatten)]
    run_args: SharedOverrideArgs,
    #[command(subcommand)]
    command: Option<RawClawServerSubcommand>,
}

#[derive(Debug, Subcommand)]
enum RawClawServerSubcommand {
    PrintConfig(SharedOverrideArgs),
    Service(RawClawServerServiceCli),
}

#[derive(Debug, Parser)]
struct RawClawServerServiceCli {
    #[command(subcommand)]
    command: RawClawServerServiceSubcommand,
}

#[derive(Debug, Subcommand)]
enum RawClawServerServiceSubcommand {
    PrintManifest(RawClawServerServicePrintManifestArgs),
    Install(RawClawServerServiceLifecycleArgs),
    Start(RawClawServerServiceLifecycleArgs),
    Stop(RawClawServerServiceLifecycleArgs),
    Restart(RawClawServerServiceLifecycleArgs),
    Status(RawClawServerServiceLifecycleArgs),
}

#[derive(Debug, Clone, Args, PartialEq, Eq)]
struct RawClawServerServicePrintManifestArgs {
    #[arg(long = "platform", value_enum)]
    platform: ClawServerServicePlatform,
    #[command(flatten)]
    shared: SharedOverrideArgs,
}

#[derive(Debug, Clone, Args, PartialEq, Eq)]
struct RawClawServerServiceLifecycleArgs {
    #[arg(long = "platform", value_enum)]
    platform: Option<ClawServerServicePlatform>,
    #[command(flatten)]
    shared: SharedOverrideArgs,
}

pub fn parse_cli_args<I, T>(args: I) -> Result<ClawServerCliCommand, clap::Error>
where
    I: IntoIterator<Item = T>,
    T: Into<OsString> + Clone,
{
    let cli = RawClawServerCli::try_parse_from(args)?;

    Ok(match cli.command {
        Some(RawClawServerSubcommand::PrintConfig(args)) => {
            ClawServerCliCommand::PrintConfig(args.into())
        }
        Some(RawClawServerSubcommand::Service(service)) => match service.command {
            RawClawServerServiceSubcommand::PrintManifest(args) => {
                ClawServerCliCommand::Service(ClawServerServiceCommand::PrintManifest(args.into()))
            }
            RawClawServerServiceSubcommand::Install(args) => {
                ClawServerCliCommand::Service(ClawServerServiceCommand::Install(args.into()))
            }
            RawClawServerServiceSubcommand::Start(args) => {
                ClawServerCliCommand::Service(ClawServerServiceCommand::Start(args.into()))
            }
            RawClawServerServiceSubcommand::Stop(args) => {
                ClawServerCliCommand::Service(ClawServerServiceCommand::Stop(args.into()))
            }
            RawClawServerServiceSubcommand::Restart(args) => {
                ClawServerCliCommand::Service(ClawServerServiceCommand::Restart(args.into()))
            }
            RawClawServerServiceSubcommand::Status(args) => {
                ClawServerCliCommand::Service(ClawServerServiceCommand::Status(args.into()))
            }
        },
        None => ClawServerCliCommand::Run(cli.run_args.into()),
    })
}

impl From<SharedOverrideArgs> for ClawServerRunArgs {
    fn from(value: SharedOverrideArgs) -> Self {
        Self {
            config_path: value.config_path,
            host: value.host,
            port: value.port,
        }
    }
}

impl From<SharedOverrideArgs> for ClawServerPrintConfigArgs {
    fn from(value: SharedOverrideArgs) -> Self {
        Self {
            config_path: value.config_path,
            host: value.host,
            port: value.port,
        }
    }
}

impl From<RawClawServerServicePrintManifestArgs> for ClawServerServicePrintManifestArgs {
    fn from(value: RawClawServerServicePrintManifestArgs) -> Self {
        Self {
            platform: value.platform,
            config_path: value.shared.config_path,
            host: value.shared.host,
            port: value.shared.port,
        }
    }
}

impl From<RawClawServerServiceLifecycleArgs> for ClawServerServiceLifecycleArgs {
    fn from(value: RawClawServerServiceLifecycleArgs) -> Self {
        Self {
            platform: value
                .platform
                .unwrap_or_else(ClawServerServicePlatform::default_current),
            config_path: value.shared.config_path,
            host: value.shared.host,
            port: value.shared.port,
        }
    }
}
