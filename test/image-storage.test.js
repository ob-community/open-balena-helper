const { getImageStorageCredentials } = require('../dist/image-storage');

describe('getImageStorageCredentials', () => {
  it('returns both configured credentials', () => {
    expect(
      getImageStorageCredentials({
        IMAGE_STORAGE_ACCESS_KEY: 'access-key',
        IMAGE_STORAGE_SECRET_KEY: 'secret-key',
      })
    ).toEqual({
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
    });
  });

  it.each([
    {},
    {
      IMAGE_STORAGE_ACCESS_KEY: '',
      IMAGE_STORAGE_SECRET_KEY: '',
    },
  ])('treats missing or empty credential pairs as absent', (environment) => {
    expect(getImageStorageCredentials(environment)).toBeUndefined();
  });

  it.each([
    {
      IMAGE_STORAGE_ACCESS_KEY: 'access-key',
      IMAGE_STORAGE_SECRET_KEY: '',
    },
    {
      IMAGE_STORAGE_ACCESS_KEY: '',
      IMAGE_STORAGE_SECRET_KEY: 'secret-key',
    },
  ])('rejects partial credential pairs', (environment) => {
    expect(() => getImageStorageCredentials(environment)).toThrow(
      'IMAGE_STORAGE_ACCESS_KEY and IMAGE_STORAGE_SECRET_KEY must be provided together'
    );
  });
});
