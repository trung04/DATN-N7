'use strict';
let plannerTrip=null,plannerDay=1,plannerBusy=false,plannerUser=null;
let plannerSaved=null,plannerName='';
function plannerMessage(role,text){
 const row=node('div',undefined,'planner-message '+role),avatar=node('span',role==='user'?'B':'✳','planner-avatar'),body=node('div',undefined,'planner-message-body');
 body.append(node('small',role==='user'?'Bạn':'Trợ lý hành trình'),node('div',text,'planner-message-text'));row.append(avatar,body);$('chatHistory').append(row);$('chatHistory').scrollTop=$('chatHistory').scrollHeight;return body;
}
function plannerWelcome(){
 $('chatHistory').replaceChildren();plannerMessage('assistant','Chào bạn! Hãy cho mình biết điểm đến, ngày khởi hành, số ngày, sở thích, số người, phương tiện và khung giờ đi chơi mỗi ngày. Mình sẽ hỏi phần còn thiếu, tóm tắt ràng buộc để bạn xác nhận rồi mới tạo lịch.');
 const suggestions=node('div',undefined,'planner-suggestions');
 for(const text of ['Lập lịch Đà Nẵng 3 ngày, thích biển và ẩm thực','Tìm địa điểm thiên nhiên yên tĩnh ở Hội An']){
  const button=node('button',text);button.type='button';button.onclick=()=>{$('chatMessage').value=text;$('chatMessage').focus();};suggestions.append(button);
 }$('chatHistory').append(suggestions);
}
function plannerEmpty(){
 const out=$('itineraryContent');out.replaceChildren();const empty=node('div',undefined,'planner-empty');
 empty.append(node('div','✳','planner-empty-icon'),node('small','CHUYẾN ĐI CỦA BẠN'),node('h2','Một hành trình mới\nđang chờ bạn'),node('p','Trò chuyện với trợ lý để tạo lịch trình. Các ngày, điểm đến và thời gian di chuyển sẽ xuất hiện tại đây.'));
 const steps=node('div',undefined,'planner-empty-steps');for(const text of ['01 · Cung cấp yêu cầu chuyến đi','02 · Kiểm tra và xác nhận ràng buộc','03 · Nhận và chỉnh lịch bằng chat'])steps.append(node('span',text));empty.append(steps);out.append(empty);
}
const plannerTime=value=>value?value.slice(11,16):'—';
function plannerDate(value){try{return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z'));}catch{return value;}}
function renderPlannerTrip(){
 if(!plannerTrip){plannerEmpty();return;}
 const trip=plannerTrip,out=$('itineraryContent');out.replaceChildren();
 const header=node('div',undefined,'planner-trip-header');header.append(node('small','BẢN XEM TRƯỚC · CHƯA LƯU THAY ĐỔI'),node('h2',trip.city));
 const meta=node('div',undefined,'planner-trip-meta');meta.append(node('span',trip.days.length+' ngày'),node('span',plannerDate(trip.start_date)),node('span',(trip.party_size||1)+' người'));
 header.append(meta);if(trip.status==='partial')header.append(node('p','Một phần lịch trình chưa xếp đủ. Xem lưu ý bên dưới.','planner-partial'));out.append(header);
 const controls=node('div',undefined,'planner-demo-controls');const name=node('input');name.id='plannerTripName';name.setAttribute('aria-label','Tên lịch demo');name.maxLength=200;name.value=plannerName||('Chuyến đi '+trip.city);name.oninput=()=>{plannerName=name.value;};
 const save=node('button',plannerSaved?'Lưu cập nhật':'Lưu lịch demo','primary');save.id='saveDemoTrip';save.type='button';save.onclick=savePlannerDemo;
 const optimize=node('button','Tối ưu lại');optimize.id='reoptimizeDemoTrip';optimize.type='button';optimize.onclick=()=>plannerAction(async()=>{
  const changed=await api('/api/v1/trips/previews/'+encodeURIComponent(plannerTrip.draft_id)+'/reoptimize',{user_id:user(),expected_version:plannerTrip.version});
  plannerTrip=changed.result;lastTrip=plannerTrip;renderPlannerTrip();$('chatStatus').textContent='Đã tính lại bản xem trước; chưa lưu thay đổi.';
 });
 const download=node('button','Xuất JSON');download.id='exportDemoTrip';download.type='button';download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(plannerTrip,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='lich-trinh-demo.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 controls.append(name,save,optimize,download,node('small','Lưu trong AI demo, độc lập với tài khoản và database backend.'));out.append(controls);
 const tabs=node('div',undefined,'planner-day-tabs');for(const day of trip.days){const button=node('button','Ngày '+day.day);button.type='button';button.classList.toggle('active',day.day===plannerDay);button.onclick=()=>{plannerDay=day.day;renderPlannerTrip();};tabs.append(button);}out.append(tabs);
 const day=trip.days.find(d=>d.day===plannerDay)||trip.days[0];if(!day)return;
 const summary=node('div',undefined,'planner-day-summary');summary.append(node('h3','Ngày '+day.day+' · '+plannerDate(day.date)),node('p',day.activities.length+' điểm đến · '+day.total_travel_minutes+' phút di chuyển · '+Number(day.total_distance_km||0).toLocaleString('vi-VN',{maximumFractionDigits:1})+' km'));out.append(summary);
 if(trip.routing?.estimated||day.routing?.estimated)out.append(node('p','Thời gian và quãng đường di chuyển đang được ước tính.','planner-routing-note'));
 const timeline=node('div',undefined,'planner-timeline');out.append(timeline);
 if(!day.activities.length)timeline.append(node('p','Chưa có địa điểm phù hợp để xếp cho ngày này. Bạn có thể yêu cầu điều chỉnh chuyến đi trong chat.','muted'));
 for(const [index,a] of day.activities.entries()){
  if(index>0)timeline.append(node('div','↓ '+a.travel_time_from_previous+' phút di chuyển · '+Number(a.distance_from_previous_km||0).toLocaleString('vi-VN',{maximumFractionDigits:1})+' km','planner-travel-leg'));
  const stop=node('article',undefined,'planner-stop');stop.append(node('span',String(index+1),'planner-stop-number'));
  const body=node('div',undefined,'planner-stop-body');body.append(node('small',plannerTime(a.start_time)+' – '+plannerTime(a.end_time)),node('h3',a.name),node('p',({Attraction:'Tham quan',Restaurant:'Ăn uống',Hotel:'Nghỉ ngơi'}[a.place_type]||a.place_type)+' · '+a.duration_minutes+' phút','muted'));
  const actions=node('div',undefined,'planner-stop-actions'),detail=node('button','Xem địa điểm');detail.type='button';detail.dataset.placeDetail=a.place_id;actions.append(detail);
  const replace=node('button','Yêu cầu thay điểm');replace.type='button';replace.onclick=()=>{$('chatMessage').value='Ngày '+day.day+' bỏ '+a.name+', thay bằng ';$('chatMessage').focus();};actions.append(replace);body.append(actions);
  const remove=node('button','Bỏ điểm này');remove.type='button';remove.onclick=()=>plannerAction(async()=>{const changed=await api('/api/v1/trips/previews/'+encodeURIComponent(plannerTrip.draft_id)+'/days/'+day.day,{user_id:user(),expected_version:plannerTrip.version,remove_place_ids:[a.place_id]},'PATCH');plannerTrip=changed.result;lastTrip=plannerTrip;renderPlannerTrip();$('chatStatus').textContent='Đã bỏ điểm và tính lại ngày '+day.day+'; chưa lưu thay đổi.';});actions.append(remove);
  if(index>0){const up=node('button','Lên trước');up.type='button';up.onclick=()=>plannerAction(async()=>{const ids=day.activities.map(p=>p.place_id);[ids[index-1],ids[index]]=[ids[index],ids[index-1]];const changed=await api('/api/v1/trips/previews/'+encodeURIComponent(plannerTrip.draft_id)+'/days/'+day.day,{user_id:user(),expected_version:plannerTrip.version,ordered_place_ids:ids},'PATCH');plannerTrip=changed.result;lastTrip=plannerTrip;renderPlannerTrip();$('chatStatus').textContent='Đã đổi thứ tự và kiểm tra lại các ràng buộc của ngày.';});actions.append(up);}
  if(a.notes?.length){const details=node('details');details.append(node('summary','Lưu ý cho điểm đến này'));for(const note of a.notes)details.append(node('p',note));body.append(details);}
  stop.append(body);timeline.append(stop);
 }
 if(day.return_leg)timeline.append(node('p','Quay về nơi xuất phát lúc '+plannerTime(day.return_leg.arrival_time),'planner-travel-leg'));
 const add=node('details',undefined,'planner-add-place');add.append(node('summary','Thêm địa điểm vào ngày '+day.day));const query=node('input');query.setAttribute('aria-label','Tìm địa điểm thêm vào ngày '+day.day);query.placeholder='Nhập tên hoặc nhu cầu, ví dụ cà phê';const find=node('button','Tìm địa điểm để thêm');find.type='button';const choices=node('div');
 find.onclick=()=>plannerAction(async()=>{if(!query.value.trim())throw Error('Nhập tên hoặc nhu cầu địa điểm');const data=await api('/api/v1/search/places',{query:query.value.trim(),filters:{city:trip.city,exclude_place_ids:trip.days.flatMap(d=>d.activities.map(p=>p.place_id))},infer_filters:false,limit:5});choices.replaceChildren();if(!data.results.length)choices.append(node('p','Không tìm thấy địa điểm phù hợp.'));for(const p of data.results){if(!['Attraction','Restaurant'].includes(p.place_type))continue;const pick=node('button','Thêm '+p.name);pick.type='button';pick.onclick=()=>plannerAction(async()=>{const changed=await api('/api/v1/trips/previews/'+encodeURIComponent(plannerTrip.draft_id)+'/days/'+day.day,{user_id:user(),expected_version:plannerTrip.version,add_place_ids:[p.place_id],target_stops:Math.min(30,day.activities.length+1)},'PATCH');plannerTrip=changed.result;lastTrip=plannerTrip;renderPlannerTrip();$('chatStatus').textContent='Đã thêm điểm và tính lại lịch trong giới hạn thời gian.';});choices.append(pick);}});
 add.append(query,find,node('p','Thêm một điểm tăng mục tiêu số điểm riêng ngày này; vẫn kiểm tra tối đa 480 phút và giờ mở cửa.','muted'),choices);out.append(add);
 if(trip.warnings?.length){const warnings=node('details',undefined,'planner-warnings');warnings.append(node('summary','Lưu ý chuyến đi ('+trip.warnings.length+')'));for(const warning of trip.warnings)warnings.append(node('p',warning));out.append(warnings);}
 out.append(node('p','Bạn muốn thay đổi? Nhắn “Ngày '+day.day+' bỏ [tên địa điểm], thay bằng [mong muốn]”.','planner-edit-hint'));
}
function resetPlanner(){conversationId=null;lastTrip=null;plannerTrip=null;plannerDay=1;plannerUser=null;plannerSaved=null;plannerName='';$('chatMessage').value='';$('chatStatus').textContent='';$('demoSavedTrips').replaceChildren();plannerWelcome();plannerEmpty();}
async function plannerAction(work){if(plannerBusy)return;plannerBusy=true;$('sendPlannerChat').disabled=true;$('resetChat').disabled=true;$('userId').disabled=true;$('chatStatus').textContent='Đang xử lý…';try{await work();}catch(e){$('chatStatus').textContent=e.message;plannerMessage('assistant','Chưa thực hiện được: '+e.message+'. Lịch hiện tại vẫn được giữ.');}finally{plannerBusy=false;$('sendPlannerChat').disabled=false;$('resetChat').disabled=false;$('userId').disabled=false;}}
async function savePlannerDemo(){if(!plannerTrip?.draft_id)return;return plannerAction(async()=>{
 const saved=await api('/api/v1/demo/trips',{user_id:user(),draft_id:plannerTrip.draft_id,expected_draft_version:plannerTrip.version,name:($('plannerTripName').value||'').trim(),...(plannerSaved?{trip_id:plannerSaved.id,expected_version:plannerSaved.version}:{})});
 plannerSaved={id:saved.id,version:saved.version};plannerName=saved.name;$('chatStatus').textContent='Đã lưu lịch trong AI demo (phiên bản '+saved.version+').';renderPlannerTrip();
});}
$('loadDemoTrips').onclick=()=>plannerAction(async()=>{
 const uid=user(),data=await api('/api/v1/demo/trips?user_id='+encodeURIComponent(uid),undefined,'GET'),list=$('demoSavedTrips');list.replaceChildren();if(!data.items.length)list.append(node('p','Chưa có lịch demo đã lưu cho User ID này.','muted'));
 for(const item of data.items){const row=node('div',undefined,'planner-saved-row'),open=node('button',item.name+' · v'+item.version),remove=node('button','Xóa');open.type=remove.type='button';
 open.onclick=()=>plannerAction(async()=>{const saved=await api('/api/v1/demo/trips/'+encodeURIComponent(item.id)+'?user_id='+encodeURIComponent(user()),undefined,'GET');const draft=await api('/api/v1/demo/trips/'+encodeURIComponent(item.id)+'/preview',{user_id:user(),expected_version:saved.version});conversationId=null;plannerTrip=draft.result;lastTrip=plannerTrip;plannerSaved={id:saved.id,version:saved.version};plannerName=saved.name;plannerDay=1;plannerUser=user();plannerWelcome();renderPlannerTrip();$('chatStatus').textContent='Đã mở lịch đã lưu thành bản xem trước để chỉnh sửa.';});
 remove.onclick=()=>plannerAction(async()=>{await api('/api/v1/demo/trips/'+encodeURIComponent(item.id)+'?user_id='+encodeURIComponent(user())+'&expected_version='+item.version,undefined,'DELETE');row.remove();if(plannerSaved?.id===item.id)plannerSaved=null;$('chatStatus').textContent='Đã xóa lịch demo đã lưu.';});row.append(open,remove);list.append(row);}
});
$('userId').addEventListener('change',()=>{if(!plannerBusy)resetPlanner();});
$('resetChat').onclick=()=>{if(!plannerBusy)resetPlanner();};
$('chatForm').onsubmit=async event=>{
 event.preventDefault();if(plannerBusy)return;
 let uid;try{uid=user();}catch(e){$('chatStatus').textContent=e.message;return;}
 const message=$('chatMessage').value.trim();if(!message)return;
 if(plannerUser&&plannerUser!==uid)resetPlanner();plannerUser=uid;
 plannerBusy=true;$('sendPlannerChat').disabled=true;$('resetChat').disabled=true;$('useLlm').disabled=true;$('userId').disabled=true;
 plannerMessage('user',message);$('chatMessage').value='';$('chatStatus').textContent='Trợ lý đang xử lý yêu cầu… Có thể mất khoảng 30 giây.';
 const pending=plannerMessage('assistant','Đang suy nghĩ…');pending.classList.add('planner-thinking');
 try{
  const body={user_id:uid,message,use_llm:$('useLlm').checked,preview_only:true,context:{routing_provider:'ors',allow_estimated_routes:false}};if(conversationId)body.conversation_id=conversationId;
  if(plannerTrip){body.draft_id=plannerTrip.draft_id;body.expected_version=plannerTrip.version;}
  const d=await api('/api/v1/chat',body);conversationId=d.conversation_id||conversationId;
  pending.parentElement?.remove();
  let answer=d.message||d.result?.answer;
  if(!answer&&d.result?.results)answer='Mình tìm thấy '+d.result.results.length+' địa điểm phù hợp. Bạn có thể xem chi tiết bên dưới hoặc yêu cầu lập lịch trình.';
  const bubble=plannerMessage('assistant',answer||'Mình đã xử lý yêu cầu của bạn.');
  if(d.result?.results)for(const p of d.result.results){const button=node('button',p.name,'planner-result-link');button.type='button';button.dataset.placeDetail=p.place_id;bubble.append(button);}
  if(d.trip){plannerTrip=d.trip;lastTrip=d.trip;plannerDay=plannerTrip.days.some(x=>x.day===plannerDay)?plannerDay:1;renderPlannerTrip();}
  $('chatStatus').textContent=d.status==='needs_clarification'?'Bạn trả lời ngay trong ô chat để tiếp tục.':d.trip?'Đã cập nhật bản xem trước. Bấm Lưu lịch demo khi bạn đồng ý.':'';
 }catch(e){pending.parentElement?.remove();plannerMessage('assistant','Chưa xử lý được yêu cầu: '+e.message);$('chatMessage').value=message;$('chatStatus').textContent='Bạn có thể sửa tin nhắn và gửi lại. Lịch trình hiện tại vẫn được giữ.';}
 finally{plannerBusy=false;$('sendPlannerChat').disabled=false;$('resetChat').disabled=false;$('useLlm').disabled=false;$('userId').disabled=false;$('chatMessage').focus();}
};
resetPlanner();
