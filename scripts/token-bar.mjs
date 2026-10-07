import {boundedPosition} from './inline-results.mjs';
export function renderTokenBar({actors,request,open}){
 document.getElementById('riftan-token-bar')?.remove();
 if(!canvas?.ready||!game.settings.get('riftan-charbar','compactBar'))return;
 const bar=document.createElement('nav');bar.id='riftan-token-bar';bar.setAttribute('aria-label',game.i18n.localize('RIFTAN_CHARBAR.TITLE'));
 const action=(label,callback)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>Promise.resolve().then(callback).catch(e=>ui.notifications.error(e.message)));bar.append(b);return b;};
 for(const actor of actors()){
  const button=action(actor.name,()=>actor.sheet.render(true));button.title=actor.name;
  const image=document.createElement('img');image.src=actor.img||'icons/svg/mystery-man.svg';image.alt='';button.prepend(image);
 }
 action(game.i18n.localize('RIFTAN_CHARBAR.OPEN_PANEL'),open);
 if(game.user.isGM){
  action(game.i18n.localize('RIFTAN_CHARBAR.REQUEST_TARGETS'),()=>request([...game.user.targets]));
  action(game.i18n.localize('RIFTAN_CHARBAR.REQUEST_SELECTED'),()=>request(canvas.tokens.controlled));
 }
 document.body.append(bar);
 const place=position=>{const p=boundedPosition(position,bar.offsetWidth,bar.offsetHeight,innerWidth,innerHeight);bar.style.left=p.x+'px';bar.style.top=p.y+'px';bar.style.bottom='auto';return p;};
 const saved=game.settings.get('riftan-charbar','barPosition');if(saved)place(saved);
 const grip=document.createElement('button');grip.type='button';grip.textContent='⠿';grip.title=game.i18n.localize('RIFTAN_CHARBAR.DRAG_BAR');grip.style.touchAction='none';grip.style.cursor='grab';bar.prepend(grip);
 grip.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;event.preventDefault();const rect=bar.getBoundingClientRect(),dx=event.clientX-rect.left,dy=event.clientY-rect.top;
  grip.setPointerCapture(event.pointerId);
  const move=e=>place({x:e.clientX-dx,y:e.clientY-dy});
  const end=e=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',end);grip.removeEventListener('pointercancel',cancel);void game.settings.set('riftan-charbar','barPosition',move(e));};
  const cancel=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',end);grip.removeEventListener('pointercancel',cancel);place({x:rect.left,y:rect.top});};
  grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',cancel);
 });
 grip.addEventListener('keydown',e=>{const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];if(!delta)return;e.preventDefault();const r=bar.getBoundingClientRect();void game.settings.set('riftan-charbar','barPosition',place({x:r.left+delta[0],y:r.top+delta[1]}));});
}
