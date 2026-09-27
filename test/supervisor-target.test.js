const {
  getLegacySupervisorVersionUrl,
  getSupervisorTargetUrl,
  getSupervisorTargetVersion,
} = require('../dist/supervisor-target');

describe('getSupervisorTargetVersion', () => {
  it('uses the desired Supervisor release when assigned', () => {
    expect(
      getSupervisorTargetVersion({
        supervisor_version: '17.0.3',
        should_be_managed_by__release: [{ raw_version: '19.2.1' }],
      })
    ).toBe('19.2.1');
  });

  it('uses a desired Supervisor release returned through the inverse relationship', () => {
    expect(getSupervisorTargetVersion({ raw_version: '19.2.1' })).toBe(
      '19.2.1'
    );
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

  it('queries the inverse desired Supervisor relationship through the v7 API', () => {
    expect(getSupervisorTargetUrl('api.example.com', 'uuid-filter')).toBe(
      'https://api.example.com/v7/release?$select=raw_version&$filter=should_manage__device/any(d:d/uuid-filter)'
    );
  });

  it('provides a legacy query for APIs without v7', () => {
    expect(
      getLegacySupervisorVersionUrl('api.example.com', 'uuid-filter')
    ).toBe(
      'https://api.example.com/v6/device?$select=supervisor_version&$filter=uuid-filter'
    );
  });
});
