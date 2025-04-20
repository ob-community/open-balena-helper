import * as express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import axios from 'axios';
import logger from './logger';

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

function createHttpServer(listenPort: number) {
  const app = express();

  app.get('/download', async (req, res) => {
    const route = (req.route as ExpressRoute | undefined)?.path ?? 'unknown route';

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
          jwt,
        },
        'Got download request'
      );

      if (!deviceTypeStr) throw new Error('deviceType param must be provided');
      if (!jwt) throw new Error('authorization header must be provided');

      const client = new S3Client({
        region: 'us-east-1',
        credentials: {
          accessKeyId: process.env.IMAGE_STORAGE_ACCESS_KEY ?? '',
          secretAccessKey: process.env.IMAGE_STORAGE_SECRET_KEY ?? '',
        },
        endpoint: `https://${process.env.IMAGE_STORAGE_ENDPOINT}`,
        forcePathStyle: process.env.IMAGE_STORAGE_FORCE_PATH_STYLE === 'true',
      });

      const command = new GetObjectCommand({
        Bucket: process.env.IMAGE_STORAGE_BUCKET,
        Key: `${process.env.IMAGE_STORAGE_PREFIX}/${deviceTypeStr}/${versionStr}/image/balena.img`,
      });

      const response = await client.send(command);
      const body = response.Body;
      if (body instanceof Readable) {
        if (response.ContentLength) {
          res.setHeader('Content-Length', response.ContentLength);
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
    const route = (req.route as ExpressRoute | undefined)?.path ?? 'unknown route';
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
        const safeError = error instanceof Error ? error : new Error(String(error));
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
        const andSupervisorVersion = encodeURIComponent(`and supervisor_version eq 'v${ver}'`);
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
      res.status(response.status).send(response.data);
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
    logger.info(
      { component, port: listenPort },
      'Listening on port'
    );
  });
}

createHttpServer(PORT);
