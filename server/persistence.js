import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DB = { jobs: {}, completedByGameId: {} };

export class Persistence {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(DEFAULT_DB, null, 2));
    }
  }

  async read() {
    await this.init();
    const raw = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(raw);
  }

  async write(data) {
    await this.init();
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }
}
