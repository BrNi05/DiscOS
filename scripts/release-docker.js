import { execSync } from 'child_process';
import pkg from '../package.json' assert { type: 'json' };

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
  execSync(`docker push ${tag}`, { stdio: 'inherit' });
});
