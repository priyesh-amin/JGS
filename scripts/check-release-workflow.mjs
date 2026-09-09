import { readFile } from 'node:fs/promises';

const workflowPath = new URL('../.github/workflows/deploy-application.yml', import.meta.url);
const workflow = await readFile(workflowPath, 'utf8');

const forbidden = [
  ['raw D1 administration', /apply-management-migration|\/d1\/database/],
  ['Workers schedule administration', /retire-legacy-schedule|\/workers\/scripts\/.*\/schedules/],
];
const required = [
  ['the verification command', 'npm run check'],
  ['the Pages deployment command', 'pages deploy dist --project-name=jaguargolfsociety --branch=main'],
  ['deployment concurrency', 'concurrency:'],
  ['cancel-in-progress protection', 'cancel-in-progress: true'],
];

const violations = forbidden
  .filter(([, pattern]) => pattern.test(workflow))
  .map(([label]) => 'Forbidden ' + label + ' found in the routine deployment workflow.');
const missing = required
  .filter(([, text]) => !workflow.includes(text))
  .map(([label]) => 'Required ' + label + ' is missing from the routine deployment workflow.');

if (violations.length || missing.length) {
  console.error([...violations, ...missing].join('\n'));
  process.exit(1);
}

console.log('Routine deployment workflow policy passed.');
