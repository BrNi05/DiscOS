const { execSync } = require('child_process');
const { version } = require('../package.json');

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
