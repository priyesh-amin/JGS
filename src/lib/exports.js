export function download(name,content,type='text/csv') {
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csv(rows) { return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if (/^[=+\-@\t\r]/.test(s)) s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n'); }
