// Only the additive management migration is applied, to the existing Pages DB.
import { readFile } from 'node:fs/promises';
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
if (!account || !token) throw new Error('Existing Cloudflare deployment credentials are required.');
async function cf(path,body) {
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if (!response.ok || !result.success) throw new Error(`Cloudflare operation failed (HTTP ${response.status}, codes ${(result.errors || []).map(e=>e.code).join(',')}).`);
  return result.result;
}
const project=await cf('/pages/projects/jaguargolfsociety');
const databaseId=project.deployment_configs?.production?.d1_databases?.DB?.id;
if (!databaseId || !/^[0-9a-f-]{36}$/i.test(databaseId)) throw new Error('The existing production DB binding could not be verified.');
const database=await cf(`/d1/database/${databaseId}`);
if (database.name!=='jgs-secure-booking') throw new Error('Production database name did not match the reviewed target.');
const schema=await cf(`/d1/database/${databaseId}/query`,{sql:"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('members','events','bookings','leaderboard_state','integration_outbox')"});
if (schema[0]?.results?.length!==5) throw new Error('Required existing application tables are missing.');
await cf(`/d1/database/${databaseId}/query`,{sql:await readFile(new URL('../migrations/0005_website_management.sql',import.meta.url),'utf8')});
console.log('Additive website-management schema applied to the verified production database. Existing records preserved.');
