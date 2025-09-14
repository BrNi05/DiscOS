import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(await readFile(path.join(dir, '../package.json'), 'utf-8'));
const { version } = pkg;

const tags = [
  'discos:latest',
  'brni05/discos:latest',
  `brni05/discos:${version}`
];

console.log('Building Docker image with tags: ', tags.join(', '));
execSync(`docker build ${tags.map(t => '-t ' + t).join(' ')} .`, { stdio: 'inherit' });

tags.slice(1).forEach(tag => {
  console.log('Pushing Docker tag: ', tag);
  //execSync(`docker push ${tag}`, { stdio: 'inherit' });
});
