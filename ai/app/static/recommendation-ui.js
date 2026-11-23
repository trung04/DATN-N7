'use strict';
function renderRecommendationCards(out,data){
 const head=node('div',undefined,'rec-results-heading');
 const title=node('div');title.append(node('small','DÀNH RIÊNG CHO BẠN','rec-eyebrow'),node('h3','Điểm đến cho hành trình tiếp theo'));
 const fresh=data.diagnostics?.fresh_count||0;
 head.append(title,node('span','Hiển thị '+data.recommendations.length+'/'+$('recLimit').value+' địa điểm'+(fresh?' · '+fresh+' điểm mới':''),'rec-count'));
 out.append(head);
 const grid=node('div',undefined,'rec-grid');out.append(grid);
 for(const [index,p] of data.recommendations.entries()){
  const card=node('article',undefined,'rec-destination');
  const photo=media(p);photo.classList.add('rec-photo');
  const badge=node('span',p.fresh_since_last?'Mới lần này':'Gợi ý #'+(index+1),'rec-fresh');photo.append(badge);card.append(photo);
  const body=node('div',undefined,'rec-card-body');
  body.append(node('small','⌖ '+p.city,'destination-city'),node('h3',p.name));
  const ratingText=p.rating!=null?'★ '+Number(p.rating).toFixed(1)+' / 5':'Chưa có đánh giá';
  body.append(node('p',ratingText+' · '+Number(p.review_count||0).toLocaleString('vi-VN')+' lượt đánh giá','rec-rating'));
  const relevance=Math.round(p.score*100);
  const fit=node('div',undefined,'rec-fit');fit.append(node('span','Độ phù hợp tổng hợp'),node('strong',relevance+'/100'));
  const meter=node('div',undefined,'rec-meter');const fill=node('span');fill.style.width=Math.max(0,Math.min(100,relevance))+'%';meter.append(fill);
  body.append(fit,meter,node('p',p.fresh_since_last?'Một lựa chọn mới, vẫn gần với gu du lịch của bạn.':'Được chọn theo sở thích và chất lượng đánh giá.','rec-caption'));
  const actions=node('div',undefined,'rec-card-actions');const detail=node('button','Khám phá →','primary');detail.dataset.placeDetail=p.place_id;actions.append(detail);
  const feedback=node('p','','rec-feedback');
  for(const [label,action] of [['♡ Yêu thích','favorite'],['＋ Lưu','save']]){
   const button=node('button',label);button.type='button';let active=false;
   button.onclick=async()=>{button.disabled=true;try{const next=!active;
    await api('/api/v1/users/'+encodeURIComponent(user())+'/interactions',{event_id:crypto.randomUUID(),place_id:p.place_id,action,active:next,occurred_at:new Date().toISOString()});
    active=next;button.classList.toggle('rec-active',active);button.textContent=(active?'✓ ':'')+label;feedback.textContent='Đã cập nhật sở thích. Lần gợi ý tiếp theo sẽ dùng hành vi này.';
   }catch(e){feedback.textContent=e.message;}finally{button.disabled=false;}};actions.append(button);
  }
  body.append(actions,feedback);
  const details=node('details',undefined,'rec-explanation');details.append(node('summary','Vì sao gợi ý địa điểm này?'));
  details.append(node('p','Nội dung: '+(p.content_score==null?'chưa có':Math.round((p.content_score+1)/2*100)+'/100')+' · Bayesian Rating: '+Math.round(p.quality_score*100)+'/100'));
  details.append(node('p','MMR: '+Number(p.mmr_score??p.score).toFixed(3)+' · ID: '+p.place_id,'muted'));
  body.append(details);card.append(body);grid.append(card);
 }
}
const varietyLabel=node('label',undefined,'rec-variety');
const limitLabel=node('label','Số địa điểm muốn nhận (Top K)');limitLabel.htmlFor='recLimit';
const limitInput=node('input');limitInput.type='number';limitInput.id='recLimit';limitInput.min='1';limitInput.max='100';limitInput.step='1';limitInput.value='20';limitInput.required=true;
const limitHint=node('p','Chọn từ 1 đến 100. Hiển thị toàn bộ Top K trả về; có thể ít hơn nếu không đủ địa điểm thỏa bộ lọc.','muted');
$('recForm').querySelector('button[type="submit"]').before(limitLabel,limitInput,limitHint);
const varietyInput=node('input');varietyInput.type='checkbox';varietyInput.id='recVariety';varietyInput.checked=true;
varietyLabel.append(varietyInput,node('span','Thêm lựa chọn mới mỗi lần gợi ý'));
const hint=node('p','Giữ phần lớn điểm phù hợp, thay khoảng 30% bằng địa điểm chưa xuất hiện gần đây khi có đủ ứng viên.','muted');
$('recForm').querySelector('button[type="submit"]').before(varietyLabel,hint);
