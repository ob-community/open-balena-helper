import express from 'express';
import {
  S3Client,
  GetObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import axios from 'axios';
import logger from './logger';
import { rewriteSupervisorReleaseImageNames } from './supervisor-release';

const PORT = 80;
const component = 'open-balena-helper';

interface SupervisorResponse {
  d: { supervisor_version: string }[];
}

interface CPUArchResponse {
  d: { slug: string }[];
}

interface ExpressRoute {
  path: string;
}

function createImageStorageClient(): S3Client {
  const endpoint = process.env.IMAGE_STORAGE_ENDPOINT;
  if (!endpoint) {
    throw new Error('IMAGE_STORAGE_ENDPOINT must be provided');
  }

  const accessKeyId = process.env.IMAGE_STORAGE_ACCESS_KEY!;
  const secretAccessKey = process.env.IMAGE_STORAGE_SECRET_KEY!;

  const config: S3ClientConfig = {
    region: 'us-east-1',
    endpoint: `https://${endpoint}`,
    forcePathStyle: process.env.IMAGE_STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId, secretAccessKey },
  };

  return new S3Client(config);
}

function imageObjectKey(deviceType: string, version: string): string {
  const prefix = process.env.IMAGE_STORAGE_PREFIX;
  if (!prefix) {
    throw new Error('IMAGE_STORAGE_PREFIX must be provided');
  }
  return `${prefix}/${deviceType}/${version}/image/balena.img`;
}

function createHttpServer(listenPort: number) {
  const app = express();

  app.get('/download', async (req, res) => {
    const route =
      (req.route as ExpressRoute | undefined)?.path ?? 'unknown route';

    // balena-cli only provides deviceType and version
    // other options are offered by balena sdk but don't appear to be used anywhere
    try {
      const {
        deviceType,
        version,
        developmentMode,
        appId,
        fileType,
        imageType,
        appUpdatePollInterval,
        network,
        wifiKey,
        wifiSsid,
      } = req.query;
      const jwt = req.headers.authorization?.split(' ')?.[1];

      // Ensure deviceType and version are strings
      const deviceTypeStr = typeof deviceType === 'string' ? deviceType : '';
      const versionStr = typeof version === 'string' ? version : '';

      logger.debug(
        {
          component,
          route,
          deviceType: deviceTypeStr,
          version: versionStr,
          developmentMode,
          appId,
          fileType,
          imageType,
          appUpdatePollInterval,
          network,
          wifiKey,
          wifiSsid,
        },
        'Got download request'
      );

      if (!deviceTypeStr) throw new Error('deviceType param must be provided');
      if (!jwt) throw new Error('authorization header must be provided');

      const accessKeyId = process.env.IMAGE_STORAGE_ACCESS_KEY;
      const secretAccessKey = process.env.IMAGE_STORAGE_SECRET_KEY;
      if ((accessKeyId == null) !== (secretAccessKey == null)) {
        throw new Error(
          'IMAGE_STORAGE_ACCESS_KEY and IMAGE_STORAGE_SECRET_KEY must be provided together'
        );
      }

      let body: Readable | undefined;
      let contentLength: number | undefined;
      if (accessKeyId == null) {
        const balenaCloudAPI =
          process.env.BALENA_CLOUD_API_URL ?? 'https://api.balena-cloud.com';
        const upstream = new URL('/download', balenaCloudAPI);
        const rawQuery = req.originalUrl.split('?', 2)[1];
        if (rawQuery) {
          upstream.search = rawQuery;
        }
        const response = await axios.get<Readable>(upstream.toString(), {
          responseType: 'stream',
        });
        body = response.data;
        res.setHeader('Content-Type', 'application/octet-stream');
      } else {
        const bucket = process.env.IMAGE_STORAGE_BUCKET;
        if (!bucket) throw new Error('IMAGE_STORAGE_BUCKET must be provided');
        const key = imageObjectKey(deviceTypeStr, versionStr);
        const client = createImageStorageClient();
        const response = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key })
        );
        if (response.Body instanceof Readable) {
          body = response.Body;
        }
        contentLength = response.ContentLength;
      }

      if (body instanceof Readable) {
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        }
        body.pipe(res).on('error', (err) => {
          throw err;
        });
      } else {
        throw new Error('Invalid response from S3');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      res.status(400).send(errorMessage);
    }
  });

  app.get('/v6/supervisor_release', async (req, res) => {
    const route =
      (req.route as ExpressRoute | undefined)?.path ?? 'unknown route';
    let rawQuery = /\?(.*)/.exec(req.originalUrl)?.[1];
    const $select: string =
      typeof req.query.$select === 'string' ? req.query.$select : '';
    let $filter: string =
      typeof req.query.$filter === 'string' ? req.query.$filter : '';
    const jwt = req.headers.authorization?.split(' ')?.[1];

    logger.debug(
      {
        component,
        route,
        rawQuery,
      },
      'Got supervisor_release request'
    );

    if ($filter.includes('uuid')) {
      const uuid = /^(.*)uuid eq '([0-9a-f]+)'(.*)$/.exec($filter)?.[2];
      const apiHost = process.env.API_HOST;
      let ver: string | undefined;
      let arch: string | undefined;
      try {
        const subFilter = encodeURIComponent(`uuid eq '${uuid}'`);
        const supervisorRes = await axios.get<SupervisorResponse>(
          `https://${apiHost}/v6/device?$select=supervisor_version&$filter=${subFilter}`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }
        );
        ver = supervisorRes.data.d?.[0]?.supervisor_version;

        const cpuArchRes = await axios.get<CPUArchResponse>(
          `https://${apiHost}/v6/cpu_architecture?$select=slug&$filter=is_supported_by__device_type/any(dt:dt/describes__device/any(d:d/${subFilter}))`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }
        );
        arch = cpuArchRes.data.d?.[0]?.slug;
      } catch (error: unknown) {
        const safeError =
          error instanceof Error ? error : new Error(String(error));
        logger.error(
          { component, route, error: safeError, uuid },
          'Error getting supervisor data'
        );
      }
      logger.debug(
        {
          component,
          route,
          uuid,
          supervisorVersion: ver,
          cpuArchitecture: arch,
        },
        'Got supervisor data'
      );
      if (ver && arch) {
        const andSupervisorVersion = encodeURIComponent(
          `and supervisor_version eq 'v${ver}'`
        );
        const slug = encodeURIComponent(`slug eq '${arch}'`);
        $filter = `is_for__device_type/any(ifdt:ifdt/is_of__cpu_architecture/any(ioca:ioca/${slug}))${andSupervisorVersion}`;
        rawQuery = `$top=1&$select=${$select}&$filter=${$filter}`;
      }
    }
    logger.debug(
      { component, route, rawQuery },
      'Calling balena-cloud endpoint'
    );
    try {
      const response = await axios.get<unknown>(
        `https://api.balena-cloud.com/v6/supervisor_release?${rawQuery}`
      );
      logger.debug(
        {
          component,
          route,
          responseData: response.data,
        },
        'Returning balena-cloud response'
      );
      const responseData = rewriteSupervisorReleaseImageNames(
        response.data,
        process.env.REGISTRY2_PROXY_REMOTE_URL,
        process.env.REGISTRY2_PROXY_LOCAL_URL
      );
      res.status(response.status).send(responseData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        {
          component,
          route,
          errorMessage,
        },
        'balena-cloud error'
      );
      res.status(400).json({ success: false, message: errorMessage });
      return;
    }
  });

  app.listen(listenPort, () => {
    logger.info({ component, port: listenPort }, 'Listening on port');
  });
}

createHttpServer(PORT);
