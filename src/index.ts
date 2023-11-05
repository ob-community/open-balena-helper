import * as express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

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
          `[open-balena-helper] DOWNLOAD REQUEST:${JSON.stringify({
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
          })}`
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

  app.listen(listenPort, () => {
    console.log(`[open-balena-helper] Listening on port: ${listenPort}`);
  });
}

createHttpServer(PORT);
