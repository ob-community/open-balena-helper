import * as express from 'express';

const PORT = 80;
const DEBUG = true;

async function createHttpServer(listenPort: number) {
  const app = express();

  app.get('/download', async (req, res) => {
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
      if (DEBUG)
        console.log({
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
        });
      const jwt = req.headers.authorization?.split(' ')?.[1];
      if (!deviceType) throw new Error('deviceType param must be provided');
      if (!jwt) throw new Error('authorization header must be provided');

      res.send('REPLACE ME WITH IMAGE BINARY DATA');
    } catch (err) {
      res.status(400).send(err.message);
    }
  });

  app.listen(listenPort, () => {
    console.log(`[open-balena-delta] Listening on port: ${listenPort}`);
  });
}

createHttpServer(PORT);
