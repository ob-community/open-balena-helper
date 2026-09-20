const {
  rewriteSupervisorReleaseImageNames,
} = require('../dist/supervisor-release');

describe('rewriteSupervisorReleaseImageNames', () => {
  const response = {
    d: [
      {
        id: 1,
        image_name:
          'registry2.balena-cloud.com/v2/supervisor/supervisor-armv7hf:latest',
      },
      {
        id: 2,
        image_name: 'registry.example.com/supervisor:latest',
      },
    ],
  };

  it('rewrites matching image names when both URLs are configured', () => {
    expect(
      rewriteSupervisorReleaseImageNames(
        response,
        'registry2.balena-cloud.com',
        'registry2.openbalena.example.com'
      )
    ).toEqual({
      d: [
        {
          id: 1,
          image_name:
            'registry2.openbalena.example.com/v2/supervisor/supervisor-armv7hf:latest',
        },
        {
          id: 2,
          image_name: 'registry.example.com/supervisor:latest',
        },
      ],
    });
  });

  it.each([
    [undefined, 'registry2.openbalena.example.com'],
    ['registry2.balena-cloud.com', undefined],
    ['', 'registry2.openbalena.example.com'],
    ['registry2.balena-cloud.com', ''],
  ])(
    'returns the original response when either URL is missing',
    (remoteUrl, localUrl) => {
      expect(
        rewriteSupervisorReleaseImageNames(response, remoteUrl, localUrl)
      ).toBe(response);
    }
  );

  it('preserves unexpected response payloads', () => {
    const unexpectedResponse = { error: 'upstream error' };

    expect(
      rewriteSupervisorReleaseImageNames(
        unexpectedResponse,
        'registry2.balena-cloud.com',
        'registry2.openbalena.example.com'
      )
    ).toBe(unexpectedResponse);
  });
});
