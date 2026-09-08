import { AppError } from './errors.js';
const fail = (message) => { throw new AppError(400, 'invalid_booking_fields', message); };
export function validateFields(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid booking questions.');
  const capacity = value.capacity == null || value.capacity === '' ? null : Number(value.capacity);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) fail('Capacity must be between 1 and 500, or blank.');
  const questions = value.questions || [];
  if (!Array.isArray(questions) || questions.length > 15) fail('Use at most 15 booking questions.');
  const keys = new Set();
  const clean = questions.map(q => {
    if (!q || !/^[a-z][a-z0-9_]{0,49}$/i.test(q.key || '') || keys.has(q.key)) fail('Question identifiers must be unique.');
    keys.add(q.key);
    if (!['text','select','checkbox'].includes(q.type)) fail('Unsupported question type.');
    const label = String(q.label || '').trim();
    if (!label || label.length > 120) fail('Give each question a short label.');
    const options = q.type === 'select' ? q.options : [];
    if (!Array.isArray(options) || (q.type === 'select' && (options.length < 2 || options.length > 20 || options.some(o => typeof o !== 'string' || !o.trim() || o.length > 100) || new Set(options).size !== options.length))) fail('Provide 2–20 different choices.');
    return {key:q.key,label,type:q.type,required:Boolean(q.required),options};
  });
  const packageText=String(value.package || ''), schedule=String(value.schedule || '');
  if(packageText.length>2000 || schedule.length>2000) fail('Event package and schedule must be under 2,000 characters.');
  return {capacity,questions:clean,isCharity:Boolean(value.isCharity),package:packageText,schedule};
}
export function validateAnswers(fields, answers = {}) {
  const {questions} = validateFields(fields);
  for (const q of questions) {
    const value = answers[q.key];
    if (q.required && (value === undefined || value === '' || value === null || (q.type === 'checkbox' && value !== true))) fail(`Please answer: ${q.label}`);
    if (value === undefined || value === '') continue;
    if (q.type === 'checkbox' ? typeof value !== 'boolean' : typeof value !== 'string' || value.length > 500) fail(`Invalid answer: ${q.label}`);
    if (q.type === 'select' && !q.options.includes(value)) fail(`Choose a listed option: ${q.label}`);
  }
  return answers;
}
