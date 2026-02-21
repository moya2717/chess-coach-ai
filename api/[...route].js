import { createHandler } from '../server/app.js';

const handler = createHandler();

export default async function vercelHandler(req, res) {
  return handler(req, res);
}
