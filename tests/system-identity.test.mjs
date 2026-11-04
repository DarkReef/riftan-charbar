import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUPPORTED_SYSTEM_IDS,isSupportedSystem,getSystemFlag} from '../scripts/system-identity.mjs';

test('manifest supports both Apex package IDs with matching runtime gates and owned update sources',()=>{
    const manifest=JSON.parse(readFileSync(new URL('../module.json',import.meta.url),'utf8'));
    assert.deepEqual(manifest.relationships.systems.map(s=>s.id),SUPPORTED_SYSTEM_IDS);
    for(const system of manifest.relationships.systems) {
        assert.equal(isSupportedSystem(system.id),true);
        assert.equal(system.compatibility.minimum,system.id==='apex-heresy-ru'?'1.6.0':'1.4.2');
        assert.equal(system.manifest,`https://github.com/DarkReef/Apex-Heresy-Ru/releases/${system.id==='dark-heresy'?'download/v1.5.6-ru':'latest/download'}/system.json`);
    }
    assert.equal(isSupportedSystem('unrelated'),false);
});

test('legacy roll flags are read without validating the old package as installed',()=>{
    const data={result:48,target:{final:40}};
    const message={flags:{'dark-heresy':{rollData:data}},getFlag(){throw Error('Invalid installed package scope');}};
    assert.equal(getSystemFlag(message,'rollData'),data);
    assert.equal(getSystemFlag(message,'rollData.target.final'),40);
    assert.equal(getSystemFlag(null,'rollData'),undefined);
});

test('weapon HUD registers under either ID; native roll patch retains saved flag namespace',async()=>{
    const before={game:globalThis.game,Hooks:globalThis.Hooks,fromUuidSync:globalThis.fromUuidSync,canvas:globalThis.canvas,ChatMessage:globalThis.ChatMessage};
    try {
        const callbacks=new Map();
        globalThis.Hooks={once(name,fn){callbacks.set(name,[...(callbacks.get(name)??[]),fn]);},on(name,fn){callbacks.set(name,[...(callbacks.get(name)??[]),fn]);}};
        await import('../scripts/main.mjs?identity-contract');
        const ready=callbacks.get('ready')[0],patchRoll=callbacks.get('preCreateChatMessage')[0];
        for(const id of [...SUPPORTED_SYSTEM_IDS,'unrelated']) {
            callbacks.delete('renderTokenHUD');
            globalThis.game={system:{id},settings:{get:()=> 'publicroll'}};
            ready();
            assert.equal(callbacks.has('renderTokenHUD'),isSupportedSystem(id));
        }
        globalThis.game.system.id='apex-heresy-ru';
        globalThis.fromUuidSync=()=>({id:'actor',name:'Acolyte'});
        globalThis.canvas={scene:{id:'scene'}};
        globalThis.ChatMessage={applyRollMode(){}};
        let patch;
        patchRoll({flags:{'dark-heresy':{rollData:{actorUuid:'Actor.actor'}}},getFlag(){throw Error('Invalid scope');},updateSource(value){patch=value;}},{});
        assert.equal(patch['flags.dark-heresy.rollData'].actorUuid,'Actor.actor');
        assert.equal(patch['flags.apex-heresy-ru.rollData'],undefined);
    } finally {Object.assign(globalThis,before);}
});
