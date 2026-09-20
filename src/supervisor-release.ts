interface SupervisorRelease {
  image_name?: unknown;
  [key: string]: unknown;
}

interface SupervisorReleaseResponse {
  d?: unknown;
  [key: string]: unknown;
}

export function rewriteSupervisorReleaseImageNames(
  response: unknown,
  remoteUrl: string | undefined,
  localUrl: string | undefined
): unknown {
  if (!remoteUrl || !localUrl || !isSupervisorReleaseResponse(response)) {
    return response;
  }

  return {
    ...response,
    d: response.d.map((release) => {
      if (
        !isSupervisorRelease(release) ||
        typeof release.image_name !== 'string'
      ) {
        return release;
      }

      return {
        ...release,
        image_name: release.image_name.replaceAll(remoteUrl, localUrl),
      };
    }),
  };
}

function isSupervisorReleaseResponse(
  response: unknown
): response is SupervisorReleaseResponse & { d: unknown[] } {
  return (
    typeof response === 'object' &&
    response !== null &&
    Array.isArray((response as SupervisorReleaseResponse).d)
  );
}

function isSupervisorRelease(release: unknown): release is SupervisorRelease {
  return typeof release === 'object' && release !== null;
}
