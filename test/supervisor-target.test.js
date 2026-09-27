const { getSupervisorTargetVersion } = require('../dist/supervisor-target');

describe('getSupervisorTargetVersion', () => {
  it('uses the desired Supervisor release when assigned', () => {
    expect(
      getSupervisorTargetVersion({
        supervisor_version: '17.0.3',
        should_be_managed_by__release: [{ raw_version: '19.2.1' }],
      })
    ).toBe('19.2.1');
  });

  it('falls back to the reported version when no desired release is assigned', () => {
    expect(
      getSupervisorTargetVersion({
        supervisor_version: '17.0.3',
        should_be_managed_by__release: [],
      })
    ).toBe('17.0.3');
  });

  it('returns undefined when neither version is available', () => {
    expect(getSupervisorTargetVersion(undefined)).toBeUndefined();
  });
});
