'use strict';
const el=id=>document.getElementById(id);
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
let session=null,changes={},view='ranked',page=1,metrics=null,busy=false;
const pageSize=20;
async function api(path,body,method='GET'){
 const headers={'Content-Type':'application/json'};if(el('evalKey').value.trim())headers['X-API-Key']=el('evalKey').value.trim();
 const response=await fetch('/api/v1/search-evaluations'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok){if(response.status===401)document.querySelector('.panel details').open=true;throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail||data));}return data;
}
async function work(fn){if(busy)return;busy=true;el('evalStatus').textContent='Đang xử lý…';el('evalStatus').className='';document.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{await fn();}catch(e){el('evalStatus').textContent=e.message;el('evalStatus').className='error';}
 finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);if(session)renderLabels();}}
function labels(){return {...session.labels,...changes};}
function validLabels(){return Object.fromEntries(Object.entries(labels()).filter(([,g])=>g!=null));}
function visibleRows(){
 const ranked=new Map(session.ranking.map((p,i)=>[p.place_id,i+1]));
 const corpus=new Map(session.corpus.map(p=>[p.place_id,p]));
 const rows=view==='ranked'?session.ranking.map(p=>({...corpus.get(p.place_id),...p})):session.corpus;
 const text=el('labelSearch').value.trim().toLocaleLowerCase('vi');const grades=validLabels();
 return rows.filter(p=>(!el('onlyUnjudged').checked||grades[p.place_id]==null)&&(!text||(p.name+' '+(p.description||'')).toLocaleLowerCase('vi').includes(text))).map(p=>({...p,rank:ranked.get(p.place_id)}));
}
function choose(pid,grade){if(busy)return;changes[pid]=grade;metrics=null;el('metricsPanel').hidden=true;renderLabels();}
function renderLabels(){
 if(!session)return;
 el('workspace').hidden=false;el('activeQuery').textContent=session.query;
 el('scopeInfo').textContent=(session.filters.city||'Mọi thành phố')+' · '+(session.filters.place_type||'Mọi loại')+' · Top '+session.k+' · '+session.ranking.length+' kết quả thực tế';
 const grades=validLabels(),total=session.corpus.length,done=Object.keys(grades).length;
 el('labelProgress').style.width=(total?100*done/total:0)+'%';el('progressText').textContent=done+'/'+total+' địa điểm trong phạm vi đã được gán nhãn. Relevant (nhãn 2–3): '+Object.values(grades).filter(g=>g>=2).length;
 el('saveState').textContent='Phiên '+session.id.slice(0,8)+' · v'+session.version;
 const pending=Object.keys(changes).length;el('pendingInfo').textContent=pending?pending+' nhãn chưa lưu':'Đã lưu trên AI service';
 const rows=visibleRows(),pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);
 el('labelPage').textContent='Trang '+page+'/'+pages+' · '+rows.length+' địa điểm';
 el('previousLabels').disabled=page===1;el('nextLabels').disabled=page===pages;
 el('showRanked').classList.toggle('selected',view==='ranked');el('showCorpus').classList.toggle('selected',view==='corpus');
 const out=el('annotationRows');out.replaceChildren();
 for(const p of rows.slice((page-1)*pageSize,page*pageSize)){
  const card=make('article',null,'annotation'),info=make('div');
  const photo=make('div',null,'annotation-photo');
  const placeholder=make('span','Chưa có ảnh');photo.append(placeholder);
  const imageUrl=p.image_url||(p.image_urls||[])[0];
  if(imageUrl){try{const url=new URL(imageUrl,location.origin);if(['https:','http:'].includes(url.protocol)){
   const image=make('img');image.alt=p.name;image.loading='lazy';image.referrerPolicy='no-referrer';
   image.onload=()=>{placeholder.hidden=true;};image.onerror=()=>{image.remove();placeholder.textContent='Ảnh chưa tải được';};
   image.src=url.href;photo.append(image);
  }}catch{}}
  info.append(make('div',p.rank?'Kết quả #'+p.rank:'Ngoài Top K · Hãy kiểm tra có bị bỏ sót không','meta'),make('h3',p.name),make('p',p.city+' · '+p.place_type,'meta'));
  info.append(make('p',(p.description||'Chưa có mô tả trong dữ liệu.').slice(0,500),'evidence'));
  const details=make('details');details.append(make('summary','Xem toàn bộ bằng chứng và ID'),make('p',p.description||'Không có mô tả'),make('p','Danh mục: '+(p.categories||[]).join(', ')),make('p','Tags: '+(p.tags||[]).join(', ')),make('p','Tiện ích: '+(p.amenities||[]).join(', ')),make('p','ID: '+p.place_id));info.append(details);
  const grade=make('div',null,'grade-section');grade.append(make('span','Mức độ đáp ứng truy vấn'));
  const buttons=make('div',null,'grade-buttons');
  for(const n of [0,1,2,3,null]){const button=make('button',n==null?'×':String(n));button.type='button';button.title=n==null?'Bỏ nhãn':['Không phù hợp','Liên quan một phần','Phù hợp','Rất phù hợp'][n];button.setAttribute('aria-label',(n==null?'Bỏ nhãn':'Nhãn '+n)+' cho '+p.name);button.setAttribute('aria-pressed',String(n!=null&&grades[p.place_id]===n));if(n!=null&&grades[p.place_id]===n)button.classList.add('active');button.onclick=()=>choose(p.place_id,n);buttons.append(button);}
  grade.append(buttons);card.append(photo,info,grade);out.append(card);
 }
 if(!rows.length)out.append(make('p','Không có địa điểm trong chế độ lọc này.'));
}
function openSession(data){session=data;changes={};metrics=null;page=1;view='ranked';el('onlyUnjudged').checked=false;el('labelSearch').value='';el('metricsPanel').hidden=true;renderLabels();}
async function save(){
 const entries=Object.entries(changes);
 for(let i=0;i<entries.length;i+=200){const part=Object.fromEntries(entries.slice(i,i+200));session=await api('/'+session.id+'/labels',{expected_version:session.version,labels:part},'PATCH');for(const [pid] of Object.entries(part))delete changes[pid];}
 renderLabels();
}
async function loadList(){const d=await api('');el('savedEvaluations').replaceChildren(new Option('Chọn lượt đánh giá',''));for(const s of d.items)el('savedEvaluations').append(new Option(s.query+' · '+s.labeled+'/'+s.scope+' nhãn · '+s.id.slice(0,8),s.id));}
el('evaluationForm').onsubmit=e=>{e.preventDefault();void work(async()=>{
 if(Object.keys(changes).length)await save();
 const body={query:el('evalQuery').value.trim(),k:Number(el('evalK').value)};if(el('evalCity').value.trim())body.city=el('evalCity').value.trim();if(el('evalType').value)body.place_type=el('evalType').value;
 const start=performance.now();const d=await api('',body,'POST');d.client_latency_ms=performance.now()-start;openSession(d);el('evalStatus').textContent='Đã lưu lượt tìm kiếm. Chấm 0–3 cho Top K, rồi duyệt thêm toàn bộ phạm vi để tính Recall đầy đủ.';await loadList();
});};
el('loadEvaluations').onclick=()=>work(async()=>{await loadList();el('evalStatus').textContent='Đã tải danh sách lượt đánh giá.';});
el('openEvaluation').onclick=()=>work(async()=>{const id=el('savedEvaluations').value;if(!id)throw Error('Chọn một lượt đã lưu.');if(Object.keys(changes).length)await save();openSession(await api('/'+id));el('evalStatus').textContent='Đã mở lại lượt và các nhãn đã lưu.';});
el('showRanked').onclick=()=>{view='ranked';page=1;renderLabels();};el('showCorpus').onclick=()=>{view='corpus';page=1;renderLabels();};
el('labelSearch').oninput=()=>{page=1;renderLabels();};el('onlyUnjudged').onchange=()=>{page=1;renderLabels();};
el('previousLabels').onclick=()=>{page--;renderLabels();};el('nextLabels').onclick=()=>{page++;renderLabels();};
el('zeroPage').onclick=()=>{const grades=validLabels();for(const p of visibleRows().slice((page-1)*pageSize,page*pageSize))if(grades[p.place_id]==null)changes[p.place_id]=0;metrics=null;el('metricsPanel').hidden=true;renderLabels();};
el('saveLabels').onclick=()=>work(async()=>{await save();el('evalStatus').textContent='Đã lưu nhãn. Bạn có thể đóng trang và mở lại lượt này.';});
const number=(n,digits=3)=>n==null?'—':Number(n).toLocaleString('vi-VN',{maximumFractionDigits:digits});
function showMetrics(d){
 metrics=d;el('metricsPanel').hidden=false;el('metricScope').textContent=d.complete_scope?'Đã duyệt toàn bộ phạm vi':'Tạm tính · Chưa đủ nhãn';
 el('metricWarning').hidden=!d.warning;el('metricWarning').textContent=d.warning||'';
 const resources=d.resources;el('metricCards').replaceChildren();
 for(const [title,value,note] of [['Latency server',number(d.latency_ms,1)+' ms','Một lượt tìm kiếm; không phải trung bình hay p95.'],['RAM RSS đỉnh quan sát',number(resources.rss_sampled_peak_mib,1)+' MiB','Process AI; mẫu mỗi 50 ms, không gồm Qdrant.'],['VRAM model',resources.vram_allocated_mib==null?'Không áp dụng':number(resources.vram_allocated_mib,1)+' MiB',resources.device==='cpu'?'Embedding chạy CPU.':'Bộ nhớ đang cấp phát, không phải peak.'],['Nhãn đã duyệt',d.judged+'/'+d.scope,'Nhãn 2–3 được tính là relevant.']]){const card=make('div',null,'metric');card.append(make('small',title),make('strong',value),make('p',note));el('metricCards').append(card);}
 el('metricsBody').replaceChildren();for(const [k,m] of Object.entries(d.metrics)){const row=make('tr');for(const value of [k,number(m.recall),number(m.mrr),number(m.ndcg),number((m.judged_coverage||0)*100,0)+'%'])row.append(make('td',value));el('metricsBody').append(row);}
 el('metricsPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
el('calculateMetrics').onclick=()=>work(async()=>{await save();const d=await api('/'+session.id+'/metrics');showMetrics(d);el('evalStatus').textContent='Đã tính các chỉ số từ nhãn do bạn lưu.';});
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=make('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
el('exportEvaluation').onclick=()=>download('evaluation-'+session.id+'.json',JSON.stringify({...session,labels:validLabels(),metrics,has_unsaved_labels:Object.keys(changes).length>0},null,2),'application/json');
el('exportLabels').onclick=()=>{const grades=validLabels();const cell=v=>{v=String(v??'');if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};const rows=[['evaluation_id','query','place_id','place_name','grade','review_status']];for(const p of session.corpus)rows.push([session.id,session.query,p.place_id,p.name,grades[p.place_id]??'',grades[p.place_id]!=null?'reviewed':'unjudged']);download('labels-'+session.id+'.csv','\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
el('printEvaluation').onclick=()=>window.print();
el('aggregateMetrics').onclick=()=>work(async()=>{
 const d=await api('/reports/aggregate');const out=el('aggregateResult');out.replaceChildren(make('p',d.complete_queries+' truy vấn đầy đủ · '+d.incomplete_queries_excluded+' truy vấn chưa đủ nhãn được loại khỏi thống kê.'));
 if(!d.complete_queries){out.append(make('p','Bạn cần duyệt toàn bộ phạm vi của ít nhất một lượt trước khi tính cả bộ.','notice'));el('evalStatus').textContent='Chưa có bộ nhãn hoàn chỉnh.';return;}
 const wrap=make('div',null,'table-wrap'),table=make('table'),head=make('tr');
 for(const t of ['K','Số query','Recall@K','MRR@K','nDCG@K'])head.append(make('th',t));table.append(head);
 for(const [k,m] of Object.entries(d.metrics)){const row=make('tr');for(const v of [k,m.query_count,number(m.recall),number(m.mrr),number(m.ndcg)])row.append(make('td',v));table.append(row);}
 wrap.append(table);out.append(wrap,make('p','Latency server: trung bình '+number(d.latency_ms.mean,1)+' ms · p95 '+number(d.latency_ms.p95,1)+' ms. Các lượt đã lưu có thể gồm lượt đầu chưa warmup.','muted'));
 const exportButton=make('button','Xuất tổng hợp JSON');exportButton.onclick=()=>download('evaluation-aggregate.json',JSON.stringify(d,null,2),'application/json');out.append(exportButton);el('evalStatus').textContent='Đã tính macro trung bình trên các query đủ nhãn.';
});
window.addEventListener('beforeunload',e=>{if(Object.keys(changes).length){e.preventDefault();e.returnValue='';}});
