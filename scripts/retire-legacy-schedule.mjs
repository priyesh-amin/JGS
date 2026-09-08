// Retire the existing hourly spreadsheet job only after website cutover is active.
const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token}=process.env;
if(!account||!token) throw new Error('Existing deployment credentials are required.');
const root=`https://api.cloudflare.com/client/v4/accounts/${account}`;
async function request(path,method='GET',body){const r=await fetch(root+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok||!v.success)throw new Error(`Cloudflare schedule operation failed (${r.status}; codes ${(v.errors||[]).map(e=>e.code).join(',')}).`);return v.result;}
const response=await fetch('https://jaguargolfsociety.siteproductions.co.uk/api/status',{headers:{Accept:'application/json'}});
if(!response.ok)throw new Error('Website management status is unavailable.');
const state=await response.json();
if(state.management==='website'){
 await request('/workers/scripts/jgs-fixture-sync/schedules','PUT',[]);
 const schedules=await request('/workers/scripts/jgs-fixture-sync/schedules');
 const remaining=schedules.schedules || schedules;
 if(!Array.isArray(remaining)||remaining.length)throw new Error('Legacy schedule is still present.');
 console.log('Website management verified; legacy spreadsheet schedule is disabled.');
}else console.log('Website management has not been activated; existing schedule preserved.');
