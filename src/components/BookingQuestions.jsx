export default function BookingQuestions({questions=[], answers={}, onChange}) {
  return questions.map(q=><label className="block text-sm font-bold" key={q.key}>{q.label}{q.required?' (required)':''}
    {q.type==='select'?<select className="manage-input" required={q.required} value={answers[q.key] || ''} onChange={e=>onChange({...answers,[q.key]:e.target.value})}><option value="">Choose…</option>{q.options.map(o=><option key={o}>{o}</option>)}</select>
      :q.type==='checkbox'?<input className="ml-3 h-5 w-5" type="checkbox" required={q.required} checked={Boolean(answers[q.key])} onChange={e=>onChange({...answers,[q.key]:e.target.checked})}/>
      :<input className="manage-input" maxLength={500} required={q.required} value={answers[q.key] || ''} onChange={e=>onChange({...answers,[q.key]:e.target.value})}/>}
  </label>);
}
