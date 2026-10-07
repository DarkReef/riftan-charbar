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
}
