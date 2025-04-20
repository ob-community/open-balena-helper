# Helper for Open Balena

Open source helper for [openbalena](https://github.com/balena-io/open-balena), a platform to deploy and manage connected devices.

## Features

The goal of this project is to implement endpoints that are not part of `open-balena-api` but which are helpful to piece together complete functionality of `open-balena`. For example, the `/v6/supervisor_release` endpoint, which returns the correct supervisor version for a given device based on its architecture and is necessary to allow devices to automatically update their supervisors using the `update-balena-supervisor` service included with balenaos, and the `/download` endpoint, which allows for OS downloads provided the OS was built using the `balena-yocto-scripts` infrastructure. This package will likely expand over time as new endpoints are added, updated or removed from the `open-balena-api` project.

## Compatibility

This project is compatible with `open-balena` and specifically relies on the `open-balena-api` and `open-balena-s3` components.

## Installation

`open-balena-helper` is meant to be installed as part of `open-balena`, and ideally at the same time. For thoes running `open-balena` on k8s, we have included services to build it in the [open-balena helm project](https://github.com/dcaputo-harmoni/open-balena-helm). If you are running `open-balena` via docker-compose, you will need to modify the scripts to mirror the setup in the helm charts or recreate it using the configuration steps below.

To configure `open-balena-helper` you must define four environment variables and two volumes for the container:

Environment Variables:

- **API_HOST**: `open-balena-api` hostmame, i.e. api.openbalena.<yourdomain.com>
- **IMAGE_STORAGE_ENDPOINT**: `open-balena-s3` hostmame, i.e. s3.openbalena.<yourdomain.com>
- **IMAGE_STORAGE_BUCKET**: The bucket name where OS images are stored, i.e. "image-data"
- **IMAGE_STORAGE_PREFIX**: The prefix within the above noted bucket where OS images are stored, i.e. "images"
- **IMAGE_STORAGE_ACCESS_KEY**: The access key for your `open-balena-s3` instance
- **IMAGE_STORAGE_SECRET_KEY**: The secret key for your `open-balena-s3` instance
- **IMAGE_STORAGE_FORCE_PATH_STYLE**: You probably want this set to "true"

Proxy Configuration:

You will also need to update your haproxy instance to redirect the following URLs (which would normally route to the `open-balena-api` container) to the `open-balena-helper` container:

- **api.openbalena.<yourdomain.com>/v6/supervisor_release**
- **api.openbalena.<yourdomain.com>/download**

Alternatively, if you are using the helm project noted above for deploying your openbalena instance, these redirects will be handled for you.

## Usage

Once installed, your devices should automatically take supervisor updates via the `update-balena-supervisor` service, and you should be able to download custom os builds using the `balena os download <your-device-type> -o ./os-image.img`

## Limitations and Known Issues

- Likely many; needs more testing to cover off corner cases

## Credits

- Credit to the Balena team for developing [open-balena-api](https://github.com/balena-io/open-balena-api) and [balena-cli](https://github.com/balena-io/balena-cli), which provide a versatile framework to manage fleets of connected devices
