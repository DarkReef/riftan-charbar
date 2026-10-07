import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equippedWeapons} from '../scripts/token-weapons.mjs';
test('weapon HUD is owner-only, equipped-only and refreshes ammunition data',()=>{
 const gun={id:'g',type:'weapon',name:'Lasgun',system:{equipped:true,class:'basic',clip:{value:18,max:30}}};
 const actor={testUserPermission:u=>u.owner,items:[gun,{...gun,id:'hidden',system:{...gun.system,equipped:false}},{...gun,id:'bag',system:{...gun.system,inventory:{containerId:'bag'}}}]};
 assert.deepEqual(equippedWeapons(actor,{owner:false}),[]);
 assert.equal(equippedWeapons(actor,{owner:true}).length,1);assert.equal(equippedWeapons(actor,{owner:true})[0].ammo.percent,60);
 gun.system.clip.value=0;assert.equal(equippedWeapons(actor,{owner:true})[0].ammo.percent,0);
 gun.system.class='melee';assert.equal(equippedWeapons(actor,{owner:true})[0].ammo,null);
});
