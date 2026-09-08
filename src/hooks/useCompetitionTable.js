import {useState,useEffect,useCallback} from 'react';
import {api} from '../lib/api';
import {parseCSV} from './useGoogleSheet';
export default function useCompetitionTable(id,legacySource) {
 const [state,setState]=useState({raw:[],data:[],columns:[],loading:true,error:null});
 const refetch=useCallback(async()=>{setState(s=>({...s,loading:true}));try{
   const result=await api.get(`/api/competition-tables/${id}`);
   let parsed;
   if(result.legacy){const response=await fetch(`https://docs.google.com/spreadsheets/d/${legacySource}/export?format=csv`);if(!response.ok)throw new Error('Competition table unavailable.');parsed=parseCSV(await response.text());}
   else {const raw=result.rows,columns=raw[0] || [];parsed={raw,columns,data:raw.slice(1).filter(r=>r.some(c=>c.trim())).map(r=>Object.fromEntries(columns.map((c,i)=>[c,r[i] || ''])))};}
   setState({...parsed,loading:false,error:null});
 }catch(e){setState(s=>({...s,loading:false,error:e.message}));}},[id,legacySource]);
 useEffect(()=>{refetch();},[refetch]);return {...state,refetch};
}
