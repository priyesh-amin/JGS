// Retire the existing hourly spreadsheet job only after website cutover is active.
const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token}=process.env;
if(!account||!token) throw new Error('Existing deployment credentials are required.');
const root=`https://api.cloudflare.com/client/v4/accounts/${account}`;
async function request(path,method='GET',body){const r=await fetch(root+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok||!v.success)throw new Error(`Cloudflare schedule operation failed (${r.status}; codes ${(v.errors||[]).map(e=>e.code).join(',')}).`);return v.result;}
const project=await request('/pages/projects/jaguargolfsociety');
const id=project.deployment_configs?.production?.d1_databases?.DB?.id;
if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Existing production database binding could not be verified.');
const state=await request(`/d1/database/${id}/query`,'POST',{sql:"SELECT value FROM management_settings WHERE key='mode'"});
if(state[0]?.results?.[0]?.value==='website'){
 await request('/workers/scripts/jgs-fixture-sync/schedules','PUT',[]);
 const schedules=await request('/workers/scripts/jgs-fixture-sync/schedules');
 const remaining=schedules.schedules || schedules;
 if(!Array.isArray(remaining)||remaining.length)throw new Error('Legacy schedule is still present.');
 console.log('Website management verified; legacy spreadsheet schedule is disabled.');
}else console.log('Website management has not been activated; existing schedule preserved.');
