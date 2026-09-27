export interface SupervisorTargetDevice {
  raw_version?: string;
  supervisor_version?: string;
  should_be_managed_by__release?: {
    raw_version?: string;
  }[];
}

export function getSupervisorTargetVersion(
  device: SupervisorTargetDevice | undefined
): string | undefined {
  return (
    device?.raw_version ??
    device?.should_be_managed_by__release?.[0]?.raw_version ??
    device?.supervisor_version
  );
}

export function getSupervisorTargetUrl(
  apiHost: string,
  encodedDeviceFilter: string
): string {
  return `https://${apiHost}/v7/release?$select=raw_version&$filter=should_manage__device/any(d:d/${encodedDeviceFilter})`;
}

export function getLegacySupervisorVersionUrl(
  apiHost: string,
  encodedDeviceFilter: string
): string {
  return `https://${apiHost}/v6/device?$select=supervisor_version&$filter=${encodedDeviceFilter}`;
}
