export interface SupervisorTargetDevice {
  supervisor_version?: string;
  should_be_managed_by__release?: {
    raw_version?: string;
  }[];
}

export function getSupervisorTargetVersion(
  device: SupervisorTargetDevice | undefined
): string | undefined {
  return (
    device?.should_be_managed_by__release?.[0]?.raw_version ??
    device?.supervisor_version
  );
}
