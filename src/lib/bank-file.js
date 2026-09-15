import { unzipSync, strFromU8 } from 'fflate';

// Narrow values-only reader for the supplied single-sheet bank export.
// It never evaluates formulas, macros, links or workbook scripts.
export function bankWorkbook(bytes, Parser = DOMParser) {
  if (bytes.length>2_000_000) throw new Error('Use a bank file smaller than 2 MB.');
  let total=0;
  const files=unzipSync(bytes,{filter:file=>{
    if (!/^xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet[^/]+.xml)$/.test(file.name)) return false;
    total+=file.originalSize;
    if (!Number.isFinite(total) || total>6_000_000) throw new Error('Expanded workbook is too large.');
    return true;
  }});
  const xml=path=>{
    if (!files[path]) throw new Error('Unsupported workbook structure. Export the bank sheet as CSV.');
    const doc=new Parser().parseFromString(strFromU8(files[path]),'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid workbook XML.');
    return doc;
  };
  const book=xml('xl/workbook.xml');
  if (['1','true'].includes(book.getElementsByTagName('workbookPr')[0]?.getAttribute('date1904'))) throw new Error('Use a CSV export for a 1904-date workbook.');
  const sheets=book.getElementsByTagName('sheet');
  if (sheets.length!==1) throw new Error('Upload the bank export only, with one sheet.');
  const relId=sheets[0].getAttribute('r:id');
  const rel=Array.from(xml('xl/_rels/workbook.xml.rels').getElementsByTagName('Relationship')).find(r=>r.getAttribute('Id')===relId);
  const target=rel?.getAttribute('Target') || '';
  const path=target.startsWith('/xl/')?target.slice(1):`xl/${target}`;
  if (!/^xl\/worksheets\/sheet[^/]+.xml$/.test(path)) throw new Error('Unsupported worksheet path.');
  const strings=files['xl/sharedStrings.xml']?Array.from(xml('xl/sharedStrings.xml').getElementsByTagName('si')).map(s=>Array.from(s.getElementsByTagName('t')).map(t=>t.textContent).join('')):[];
  const rowNodes=Array.from(xml(path).getElementsByTagName('row'));
  if (rowNodes.length>2002) throw new Error('Upload at most 2000 transactions.');
  return rowNodes.map((row,index)=>{
    const cells=Array(6).fill('');
    for(const c of Array.from(row.getElementsByTagName('c'))) {
      const ref=c.getAttribute('r') || '';
      const col=ref.match(/^([A-Z]+)/)?.[1];
      if (c.getElementsByTagName('f').length) throw new Error('Upload original bank values, without formulas.');
      let value=c.getElementsByTagName('v')[0]?.textContent || '';
      const type=c.getAttribute('t');
      if(type==='s') { if (!/^\d+$/.test(value) || strings[Number(value)]===undefined) throw new Error('Invalid shared string.'); value=strings[Number(value)]; }
      if(type==='inlineStr') value=Array.from(c.getElementsByTagName('t')).map(t=>t.textContent).join('');
      if(!/^[A-F]$/.test(col || '')) { if(value.trim()) throw new Error('Expected only bank columns A–F.'); continue; }
      if(index>0 && col==='B' && value && (!type || type==='n')) {
        const serial=Number(value);
        if(!Number.isInteger(serial) || serial<61 || serial>100000) throw new Error('Invalid Excel bank date.');
        value=new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
      }
      cells[col.charCodeAt(0)-65]=value;
    }
    return cells;
  });
}
export async function readBankFile(file) {
  if (!file || file.size>2_000_000) throw new Error('Choose a CSV or XLSX bank file smaller than 2 MB.');
  if (/\.xlsx$/i.test(file.name)) return {rows:bankWorkbook(new Uint8Array(await file.arrayBuffer()))};
  if (/\.csv$/i.test(file.name)) return {csv:await file.text()};
  throw new Error('Choose CSV or XLSX.');
}
