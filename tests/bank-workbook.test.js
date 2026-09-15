import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';
import {bankWorkbook} from '../src/lib/bank-file.js';
import {BANK_COLUMNS,parseBank} from '../functions/_lib/reconciliation/bank.js';

function workbook({formula=false,date1904=false,secondSheet=false,extra=false}={}) {
  const inline=(column,value)=>`<c r="${column}1" t="inlineStr"><is><t>${value}</t></is></c>`;
  const files={
    'xl/workbook.xml':`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="${date1904?1:0}"/><sheets><sheet name="in" r:id="rId1"/>${secondSheet?'<sheet name="other" r:id="rId2"/>':''}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml':'<sst><si><t>Alex Example</t><r><t> — golf</t></r></si></sst>',
    'xl/worksheets/sheet1.xml':`<worksheet><sheetData><row>${BANK_COLUMNS.map((v,i)=>inline(String.fromCharCode(65+i),v)).join('')}</row><row><c r="A2"><v>0</v></c><c r="B2"><v>46276</v></c><c r="C2" t="inlineStr"><is><t>TEST-ACCOUNT</t></is></c><c r="D2">${formula?'<f>50+15</f>':''}<v>65</v></c><c r="E2" t="inlineStr"><is><t>Counter Credit</t></is></c><c r="F2" t="s"><v>0</v></c>${extra?'<c r="G2"><v>1</v></c>':''}</row><row><c r="A3" t="inlineStr"><is><t> </t></is></c></row></sheetData></worksheet>`
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));
}
test('bank XLSX reader preserves six columns, shared strings and Excel dates',async()=>{
  const rows=bankWorkbook(workbook(),DOMParser);
  assert.deepEqual(rows[0],BANK_COLUMNS);
  assert.equal(rows[1][1],'2026-09-11');
  assert.equal(rows[1][5],'Alex Example — golf');
  const result=await parseBank({rows,coverageFrom:'2026-09-01',coverageThrough:'2026-09-11'});
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].amountPence,6500);
});
test('bank XLSX reader rejects formulas, extra columns and unsupported workbook formats',()=>{
  for(const variant of [{formula:true},{date1904:true},{secondSheet:true},{extra:true}]) assert.throws(()=>bankWorkbook(workbook(variant),DOMParser));
  assert.throws(()=>bankWorkbook(new Uint8Array(2_000_001),DOMParser),/smaller/);
});
