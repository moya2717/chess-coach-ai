import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('rg --files src server .github/workflows scripts')
  .toString()
  .trim()
  .split('\n')
  .filter((file) => file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.yml') || file.endsWith('.mjs'));

const violations = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (content.includes('\t')) {
    violations.push(`${file}: contains tab characters`);
  }
  if (/[ \t]+$/m.test(content)) {
    violations.push(`${file}: contains trailing spaces`);
  }
}

if (violations.length > 0) {
  console.error('Lint violations found:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Lint passed for ${files.length} files.`);
