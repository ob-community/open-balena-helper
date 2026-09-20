export interface ImageStorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export function getImageStorageCredentials(
  environment: Record<string, string | undefined>
): ImageStorageCredentials | undefined {
  const accessKeyId =
    environment.IMAGE_STORAGE_ACCESS_KEY === ''
      ? undefined
      : environment.IMAGE_STORAGE_ACCESS_KEY;
  const secretAccessKey =
    environment.IMAGE_STORAGE_SECRET_KEY === ''
      ? undefined
      : environment.IMAGE_STORAGE_SECRET_KEY;

  if ((accessKeyId == null) !== (secretAccessKey == null)) {
    throw new Error(
      'IMAGE_STORAGE_ACCESS_KEY and IMAGE_STORAGE_SECRET_KEY must be provided together'
    );
  }

  if (accessKeyId == null || secretAccessKey == null) {
    return undefined;
  }

  return { accessKeyId, secretAccessKey };
}
