# Helper for OpenBalena

`open-balena-helper` supplies API operations that are needed by an OpenBalena
installation but are not implemented by `open-balena-api`.

## Routes

### `GET /download`

Streams a BalenaOS image from the configured S3-compatible image origin. The
request must include an authorization header and the `deviceType` and `version`
query parameters expected by the Balena CLI.

The image source can be either:

- Balena Cloud's `/download` endpoint; or
- an authenticated private S3-compatible service such as OpenBalena MinIO.

When image-storage credentials are omitted, the helper transparently forwards
the request to Balena Cloud without forwarding the caller's authorization
header. Balena Cloud reconstructs the image from its public chunked image store.
When credentials are provided, the helper retains its original behavior and
streams `image/balena.img` directly from the private bucket.

### `GET /v6/supervisor_release`

Forwards supervisor release queries to Balena Cloud. When a query identifies a
device UUID, the helper first resolves that device's architecture and current
supervisor version through the local `open-balena-api`, then translates the
query for Balena Cloud.

## Device-type metadata

This service intentionally does **not** proxy `/device-types/v1`.
`open-balena-api` owns that route and also resolves the same device-type metadata
internally when servicing `/download-config`. Proxying only the HTTP route would
therefore make the public listing appear correct while config generation would
still fail.

To defer to Balena Cloud without maintaining local JSON, configure
`open-balena-api` to use Balena's public image bucket:

```text
IMAGE_STORAGE_ENDPOINT=s3.amazonaws.com
IMAGE_STORAGE_BUCKET=resin-production-img-cloudformation
IMAGE_STORAGE_PREFIX=images
```

`open-balena-api` applies its `CONTRACT_ALLOWLIST` while reading that origin, so
`/device-types/v1`, image-version validation, and `/download-config` all expose
only locally supported device types. Configure the helper with
`BALENA_CLOUD_API_URL=https://api.balena-cloud.com` so `/download` delegates
image assembly and streaming to Balena Cloud. Do not configure a separate
allowlist on the helper.

## Configuration

- **API_HOST**: hostname of the local `open-balena-api`, for example
  `api.openbalena.example.com`.
- **BALENA_CLOUD_API_URL**: optional Balena Cloud API origin. Defaults to
  `https://api.balena-cloud.com`.
- **IMAGE_STORAGE_ENDPOINT**: private image-storage hostname.
- **IMAGE_STORAGE_BUCKET**: private image-storage bucket.
- **IMAGE_STORAGE_PREFIX**: private object prefix, normally `images`.
- **IMAGE_STORAGE_ACCESS_KEY** and **IMAGE_STORAGE_SECRET_KEY**: optional, but
  must either both be set or both be omitted. When omitted, `/download` is
  proxied to `BALENA_CLOUD_API_URL`.
- **IMAGE_STORAGE_FORCE_PATH_STYLE**: set to `true` for services such as MinIO;
  omit or set to `false` for standard Amazon S3 virtual-hosted access.

Route only `/download` and `/v6/supervisor_release` to this service. Route
`/download-config`, `/device-types/v1`, and other API requests to
`open-balena-api`.

## Usage

Once installed, devices can discover supervisor updates and operators can
download an image with:

```sh
balena os download <device-type> -o ./os-image.img
```

## Credits

Thanks to the Balena team for
[OpenBalena](https://github.com/balena-io/open-balena) and the Balena CLI.
