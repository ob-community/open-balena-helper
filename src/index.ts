import * as express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import axios from 'axios';

const PORT = 80;
const DEBUG = true;

async function createHttpServer(listenPort: number) {
  const app = express();

  app.get('/download', async (req, res) => {
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
      if (DEBUG)
        console.log(
          `[open-balena-helper] Got download request with params: ${JSON.stringify(
            {
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
              jwt,
            }
          )}`
        );
      if (!deviceType) throw new Error('deviceType param must be provided');
      if (!jwt) throw new Error('authorization header must be provided');
      // TODO - validate token
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
        Key: `${process.env.IMAGE_STORAGE_PREFIX}/${deviceType}/${version}/image/balena.img`,
      });
      const response = await client.send(command);
      const body = response.Body;
      if (body instanceof Readable) {
        if (response.ContentLength)
          res.setHeader('Content-Length', response.ContentLength);
        body.pipe(res).on('error', (err) => {
          throw err;
        });
      } else throw new Error('Invalid response from S3');
    } catch (err) {
      res.status(400).send(err.message);
    }
  });

  app.get('/v6/supervisor_release', async (req, res) => {
    let rawQuery = /\?(.*)/.exec(req.originalUrl)?.[1];
    const { $select } = req.query;
    let { $filter } = req.query;
    const jwt = req.headers.authorization?.split(' ')?.[1];
    if (DEBUG)
      console.log(
        `[open-balena-helper] Got v6/supervisor_release request with query: ${rawQuery}`
      );
    if (($filter as string)?.includes('uuid')) {
      const uuid = /^(.*)uuid eq '([0-9a-f]+)'(.*)$/.exec(
        $filter as string
      )?.[2];
      const apiHost = process.env.API_HOST;
      let ver, arch;
      try {
        ver = (
          await axios.get(
            `https://${apiHost}/v6/device?$select=supervisor_version&$filter=uuid%20eq%20%27${uuid}%27`,
            {
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
            }
          )
        )?.data?.d?.[0]?.supervisor_version;
        arch = (
          await axios.get(
            `https://${apiHost}/v6/cpu_architecture?$select=slug&$filter=is_supported_by__device_type/any(dt:dt/describes__device/any(d:d/uuid%20eq%20%27${uuid}%27))`,
            {
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
            }
          )
        )?.data?.d?.[0]?.slug;
      } catch (err) {
        console.log(err);
        console.log(
          `[open-balena-helper] Error getting supervisor data for UUID ${uuid}`
        );
      }
      if (DEBUG)
        console.log(
          `[open-balena-helper] Got supervisor data for UUID ${uuid}: supervisor_version: ${ver}, cpu_architecture: ${arch}`
        );
      if (ver && arch) {
        $filter = `is_for__device_type/any(ifdt:ifdt/is_of__cpu_architecture/any(ioca:ioca/slug%20eq%20%27${arch}%27))%20and%20supervisor_version%20eq%20%27v${ver}%27`;
        rawQuery = `$top=1&$select=${$select}&$filter=${$filter}`;
      }
    }
    if (DEBUG)
      console.log(
        `[open-balena-helper] Calling balena-cloud v6/supervisor_release endpoint with query: ${rawQuery}`
      );
    let response;
    try {
      response = await axios.get(
        `https://api.balena-cloud.com/v6/supervisor_release?${rawQuery}`
      );
      if (DEBUG)
        console.log(
          `[open-balena-helper] Returning balena-cloud response: ${JSON.stringify(
            response.data
          )}`
        );
      res.status(response.status).send(response.data);
    } catch (err) {
      if (DEBUG)
        console.log(`[open-balena-helper] balena-cloud error: ${err.message}`);
      res.status(400).json({ success: false, message: err.message });
      return;
    }
  });

  app.listen(listenPort, () => {
    console.log(`[open-balena-helper] Listening on port: ${listenPort}`);
  });
}

createHttpServer(PORT);
