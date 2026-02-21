import { createServer } from 'node:http';
import { createHandler } from './app.js';

const port = Number(process.env.PORT || 3001);

createServer(createHandler()).listen(port, () => {
  console.log(`Chess Coach API listening on http://localhost:${port}`);
});
