import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(await readFile(path.join(dir, '../package.json'), 'utf-8'));
const { version } = pkg;

const tags = [
  'brni05/discos:latest',
  `brni05/discos:${version}`
];

try {
  execSync('docker buildx create --use', { stdio: 'inherit' });
} catch {
  // buildx already exists
}

console.log('Building multi-platform Docker image with tags: ', tags.join(', '));

execSync(
  `docker buildx build --platform linux/amd64,linux/arm64 ${tags.map(t => '-t ' + t).join(' ')} --push .`,
  { stdio: 'inherit' }
);

console.log('Multi-platform build & push done.');