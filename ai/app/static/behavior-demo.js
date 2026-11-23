'use strict';
const historyPanel=node('section',undefined,'box');
historyPanel.id='behaviorDemo';
historyPanel.innerHTML=`<h3>Người dùng thử nghiệm có lịch sử</h3>
<p class="muted">Dữ liệu mô phỏng để kiểm tra thuật toán, không phải hành vi người dùng thật.</p>
<label for="demoUserSelect">Chọn hồ sơ đã mô phỏng</label><select id="demoUserSelect"><option value="">Đang tải hồ sơ…</option></select>
<div class="actions"><button type="button" id="refreshHistory">Tải lại lịch sử</button><button type="button" id="useHistoryUser" class="primary">Xem gợi ý cho người dùng này</button></div>
<p id="historyStatus" role="status"></p><div id="historySummary"></div><div id="historyRows"></div>`;
$('recForm').before(historyPanel);
let historyGeneration=0;
async function showUserHistory(){
 const generation=++historyGeneration,uid=$('demoUserSelect').value;
 if(!uid)return;
 $('userId').value=uid;$('recMode').value='personalized_mmr';
 $('historyStatus').textContent='Đang đọc lịch sử của '+uid;
 $('historyRows').replaceChildren();$('historySummary').replaceChildren();
 try{
  const d=await api('/api/v1/users/'+encodeURIComponent(uid)+'/interactions',undefined,'GET');
  if(generation!==historyGeneration)return;
  $('historyStatus').textContent=uid+' · '+d.total+' tương tác đã lưu';
  $('historySummary').append(node('p',Object.keys(d.positive_place_weights).length+' địa điểm có tín hiệu tích cực · '+d.negative_place_ids.length+' địa điểm bị loại do đánh giá thấp.'));
  const names={view:'Xem / click chi tiết',favorite:'Yêu thích',save:'Lưu địa điểm',rating:'Đánh giá'};
  const list=node('ol');list.style.maxHeight='320px';list.style.overflow='auto';
  for(const e of d.items){const row=node('li');row.style.marginBottom='12px';
   row.append(node('strong',e.place_name),node('div',names[e.action]+(e.active===false?' (đã bỏ chọn)':'')+(e.rating!=null?' · '+e.rating+' sao':'')+' · '+new Date(e.occurred_at).toLocaleString('vi-VN')));list.append(row);}
  $('historyRows').append(list);
  if(!d.total)$('historyRows').append(node('p','Hồ sơ chưa có tương tác.'));
  if(d.total>d.items.length)$('historyRows').append(node('p','Hiển thị '+d.items.length+' tương tác gần nhất.'));
 }catch(e){if(generation===historyGeneration)$('historyStatus').textContent='Chưa tải được lịch sử: '+e.message;}
}
async function loadDemoUsers(){
 try{const d=await api('/api/v1/recommendation/demo-users',undefined,'GET');
  const current=$('demoUserSelect').value;$('demoUserSelect').replaceChildren();
  for(const p of d.items)$('demoUserSelect').append(new Option('Người dùng thích biển · '+p.user_id+' · '+p.event_count+' tương tác',p.user_id));
  if(!d.items.length){$('demoUserSelect').append(new Option('Chưa có hồ sơ mô phỏng',''));$('historyStatus').textContent='Chạy script simulate_user.py để tạo hồ sơ thử.';return;}
  if(d.items.some(p=>p.user_id===current))$('demoUserSelect').value=current;
  await showUserHistory();
 }catch(e){$('historyStatus').textContent='Nhập API key trong Cài đặt kết nối rồi nhấn Tải lại lịch sử. '+e.message;}
}
$('demoUserSelect').onchange=()=>{void showUserHistory();};
$('refreshHistory').onclick=()=>{void loadDemoUsers();};
$('useHistoryUser').onclick=()=>{
 const uid=$('demoUserSelect').value;if(!uid)return;
 $('userId').value=uid;$('recMode').value='personalized_mmr';$('recCity').value='Đà Nẵng';$('recType').value='Attraction';
 $('recPreferences').value='';$('recQuery').value='';$('recForm').requestSubmit();
};
document.querySelector('[data-tab="recommend"]').addEventListener('click',()=>{void loadDemoUsers();});
void loadDemoUsers();
