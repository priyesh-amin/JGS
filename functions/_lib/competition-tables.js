import { AppError } from './errors.js';
import { parseCsv } from './sheet-sync.js';
export const COMPETITION_SOURCES={handicap:'11onOylPWWGTH2pHKZhu9-j6TDBu8XiKzeRlnD4vr1ys',singles:'1ZU3FaafiE50C9YPDT5fY8qLMOvIUDuu18vtvrYAh_ZE',doubles:'1fhGDgdQ099mGIwpFqEpk2jdjuxeerNTWoHgl7-6gXt0'};
export async function importCompetitionTables() {
  return Promise.all(Object.entries(COMPETITION_SOURCES).map(async([id,source])=>{
    const response=await fetch(`https://docs.google.com/spreadsheets/d/${source}/export?format=csv`);
    if(!response.ok) throw new AppError(502,'table_import_failed',`The existing ${id} table could not be imported. No changes were made.`);
    const content=await response.text();
    if(content.length>200000 || content.trim().startsWith('<')) throw new AppError(502,'table_import_failed',`The existing ${id} table returned invalid data.`);
    const rows=parseCsv(content);
    if(rows.length<2) throw new AppError(502,'table_import_failed',`The existing ${id} table is empty.`);
    return {id,rows};
  }));
}
export async function getCompetitionTable(db,id) {
  if(!COMPETITION_SOURCES[id]) throw new AppError(404,'not_found','Competition table not found.');
  const row=await db.prepare('SELECT * FROM competition_tables WHERE id=?').bind(id).first();
  if(!row) return {id,legacy:true};
  return {id,rows:JSON.parse(row.rows_json),version:row.version,updatedAt:row.updated_at};
}
export async function saveCompetitionTable(db,actor,id,input) {
  const before=await getCompetitionTable(db,id);
  if(before.version!==input.version) throw new AppError(409,'changed','This table changed. Refresh before saving.');
  const rows=input.rows;
  if(!Array.isArray(rows) || rows.length<1 || rows.length>500 || rows.some(r=>!Array.isArray(r)||r.length>30||r.some(c=>typeof c!=='string'||c.length>1000))) throw new AppError(400,'invalid_table','Use up to 500 rows and 30 columns of text.');
  const now=new Date().toISOString();
  const result=await db.batch([
    db.prepare('UPDATE competition_tables SET rows_json=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(rows),now,id,input.version),
    db.prepare("INSERT INTO management_audit SELECT ?,?,'competition_table',?,'updated',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),actor.id,id,JSON.stringify(before),JSON.stringify({rows}),now),
  ]);
  if(!result[0].meta.changes) throw new AppError(409,'changed','This table changed. Refresh before saving.');
  return {saved:true};
}
