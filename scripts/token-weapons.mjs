export function equippedWeapons(actor,user){
 if(!actor?.testUserPermission(user,'OWNER'))return [];
 return [...actor.items].filter(i=>['weapon','vehicleWeapon'].includes(i.type)&&i.system.equipped&&!i.system.inventory?.containerId).map(i=>{
  const max=Number(i.system.clip?.max)||0,value=Number(i.system.clip?.value)||0;
  return {id:i.id,name:i.name,img:i.img,ammo:i.system.class!=='melee'&&max>0?{value,max,percent:Math.max(0,Math.min(100,value/max*100))}:null};
 });
}
export function renderWeaponHUD(hud,html){
 const root=html?.querySelector?html:html?.[0]??hud.element;
 if(!root)return;
 root.querySelector('.riftan-token-weapons')?.remove();
 const actor=hud.actor??hud.object?.actor??hud.document?.actor;
 const weapons=equippedWeapons(actor,game.user);if(!weapons.length)return;
 const section=document.createElement('section');section.className='riftan-token-weapons';
 for(const weapon of weapons){
  const card=document.createElement('article');card.className='riftan-token-weapon';
  const img=document.createElement('img');img.src=weapon.img||'icons/svg/sword.svg';img.alt='';card.append(img);
  const label=document.createElement('strong');label.textContent=weapon.name;card.append(label);
  if(weapon.ammo){
   const meter=document.createElement('div');meter.className='riftan-ammo';meter.setAttribute('role','meter');meter.setAttribute('aria-label',game.i18n.localize('RIFTAN_CHARBAR.AMMO'));
   meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(weapon.ammo.max));meter.setAttribute('aria-valuenow',String(Math.max(0,Math.min(weapon.ammo.max,weapon.ammo.value))));
   const fill=document.createElement('span');fill.style.width=weapon.ammo.percent+'%';meter.append(fill);
   const count=document.createElement('b');count.textContent=`${weapon.ammo.value} / ${weapon.ammo.max}`;meter.append(count);card.append(meter);
  }
  section.append(card);
 }
 root.append(section);
}
export function registerWeaponHUD(){
 Hooks.on('renderTokenHUD',renderWeaponHUD);
 const refresh=()=>{const hud=canvas?.tokens?.hud;if(hud?.rendered)renderWeaponHUD(hud,hud.element);};
 for(const hook of ['createItem','updateItem','deleteItem','updateActor','updateToken','updateUser','createActiveEffect','updateActiveEffect','deleteActiveEffect'])Hooks.on(hook,refresh);
}
