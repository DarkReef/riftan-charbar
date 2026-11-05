import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Load the actual module entry point. Foundry hooks are exercised below, including
// the v14 distinction between rerendering ChatLog and updating an existing card.
const handlers = new Map();
globalThis.Hooks = {
    once() {},
    on(name, callback) { (handlers.get(name) ?? handlers.set(name, []).get(name)).push(callback); }
};
const emit = async (name, ...args) => {
    for (const callback of handlers.get(name) ?? []) await callback(...args);
};
const ru = JSON.parse(readFileSync(new URL('../lang/ru.json', import.meta.url), 'utf8'));
const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
let env;
function message(id, author, flags) {
    return {id, author, flags, visible:true, isContentVisible:true,
        getFlag(scope, key) { return this.flags[scope]?.[key]; },
        async setFlag(scope, key, value) {
            this.flags[scope][key] = value;
            await emit('updateChatMessage', this, {[`flags.${scope}.${key}`]:value});
        }};
}
function element() {
    const body = {innerHTML:'', querySelectorAll() { return []; }, querySelector() { return null; }};
    return {body, hidden:false, style:{}, dataset:{}, classList:{add() {}}, attributes:{},
        setAttribute(key, value) { this.attributes[key] = value; },
        querySelector(selector) { return selector === '.message-content' ? body : null; }};
}
async function render(message) {
    const html = element();
    await emit('renderChatMessageHTML', message, html);
    env.cards.set(message.id, html);
    return html;
}
function reset() {
    const gm = {id:'gm', isGM:true}, player = {id:'owner', isGM:false};
    const actor = {uuid:'Actor.a', id:'a', name:'Аколит 1',
        characteristics:{agility:{label:'Ловкость'}},
        testUserPermission:user => user?.id === player.id || user?.isGM};
    const request = {actorUuids:[actor.uuid], characteristic:'agility', skill:'', label:'Ловкость',
        modifier:10, difficulty:0, reason:'Перепрыгнуть траншею', closed:false};
    const root = message('request', gm, {'riftan-charbar':{partyRequest:request}});
    const docs = new Map([[root.id, root]]);
    env = {gm, player, actor, request, root, docs, cards:new Map(), updates:[], renders:0,
        nativeCalls:[], chosen:{modifier:15, difficulty:0}, created:[], errors:[]};
    globalThis.game = {
        user:player, system:{id:'apex-heresy-ru'},
        i18n:{lang:'ru', localize:key => ru[key] ?? key},
        messages:{get:id => docs.get(id), get contents() { return [...docs.values()]; }},
        users:{get:id => [gm, player].find(user => user.id === id)},
        settings:{get:() => 'publicroll'},
        darkHeresy:{api:{rollTest:async options => {
            env.nativeCalls.push(options);
            return {status:'resolved', context:{result:59, target:{final:45}, flags:{isSuccess:false}, dof:1,
                equipmentBonusSources:'Броня Авенджер: устойчивость (+10)'}};
        }}}
    };
    globalThis.foundry = {utils:{escapeHTML}, applications:{api:{DialogV2:{prompt:async () => env.chosen}}}};
    globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : null;
    globalThis.fromUuidSync = uuid => uuid === actor.uuid ? actor : null;
    globalThis.ui = {notifications:{error:error => env.errors.push(error)}, chat:{
        render() { env.renders++; },
        async updateMessage(doc, options) { env.updates.push({id:doc.id, options}); await render(doc); }
    }};
    globalThis.ChatMessage = {
        getSpeaker:({actor}) => ({actor:actor.id, alias:actor.name}),
        applyRollMode(data, mode) { data.rollMode = mode; },
        async create(data) {
            const doc = Object.assign(message(`response-${docs.size}`, game.user, data.flags), data);
            docs.set(doc.id, doc); env.created.push(doc);
            await emit('createChatMessage', doc); await render(doc);
            return doc;
        }
    };
    return env;
}
reset();
const {respondCheck} = await import('../scripts/main.mjs');
beforeEach(reset);
function receipt(extra={}) {
    const response = {requestId:env.root.id, actorUuid:env.actor.uuid, requestedModifier:10,
        requestedDifficulty:0, appliedModifier:15, appliedDifficulty:0,
        roll:59, target:45, success:false, degrees:1, ...extra};
    const doc = message(`receipt-${env.docs.size}`, env.player, {'riftan-charbar':{partyResponse:response}});
    env.docs.set(doc.id, doc);
    return doc;
}

test('a player receipt updates the actual GM request card with inline degrees and hover details', async () => {
    await emit('createChatMessage', env.root);
    assert.equal(env.updates.length, 0, 'Foundry posts a new root; do not insert it twice through updateMessage');
    const before = await render(env.root);
    assert.match(before.body.innerHTML, /data-party-roll/);
    const response = receipt();
    await emit('createChatMessage', response);
    const html = env.cards.get(env.root.id).body.innerHTML;
    assert.doesNotMatch(html, /data-party-roll/);
    assert.match(html, /Аколит 1/);
    assert.match(html, /1 степень провала/);
    assert.match(html, /title="[^"]*59\s*\/\s*45/);
    assert.match(html, /Модификатор: \+10 → \+15/);
    assert.match(html, /Сложность \(бонус\/штраф\): 0 → 0/);
    assert.deepEqual(env.updates.map(update => update.id), [env.root.id]);
    assert.equal(env.renders, 0, 'a full ChatLog render does not update existing v14 messages');
});

test('authored receipts stay persisted but never render as duplicate standalone chat cards', async () => {
    const doc = receipt();
    const html = await render(doc);
    assert.equal(html.hidden, true);
    assert.equal(html.style.display, 'none');
    assert.equal(env.docs.get(doc.id), doc);
    assert.equal(doc.author.id, env.player.id);
    assert.equal(doc.getFlag('riftan-charbar', 'partyResponse').roll, 59);
});

test('receipt updates and deletion refresh the root; a closed request refreshes disabled buttons', async () => {
    const doc = receipt();
    await emit('createChatMessage', doc);
    doc.flags['riftan-charbar'].partyResponse = {...doc.flags['riftan-charbar'].partyResponse,
        roll:20, success:true, degrees:3};
    await emit('updateChatMessage', doc, {'flags.riftan-charbar.partyResponse':doc.flags['riftan-charbar'].partyResponse});
    assert.match(env.cards.get(env.root.id).body.innerHTML, /3 степени успеха/);
    env.docs.delete(doc.id);
    await emit('deleteChatMessage', doc);
    assert.match(env.cards.get(env.root.id).body.innerHTML, /data-party-roll/);
    await env.root.setFlag('riftan-charbar', 'partyRequest', {...env.request, closed:true});
    const html = env.cards.get(env.root.id).body.innerHTML;
    assert.match(html, /disabled[^>]*>Закрыто/);
    assert.doesNotMatch(html, /data-party-close/);
});

test('a hidden or unauthorized response does not reveal a result in the public request', async () => {
    const hidden = receipt(); hidden.isContentVisible = false;
    await emit('createChatMessage', hidden);
    assert.match(env.cards.get(env.root.id).body.innerHTML, /data-party-roll/);
    assert.doesNotMatch(env.cards.get(env.root.id).body.innerHTML, /59\s*\/\s*45/);
    const forged = receipt(); forged.author = {id:'stranger'};
    await emit('createChatMessage', forged);
    assert.match(env.cards.get(env.root.id).body.innerHTML, /data-party-roll/);
});

test('respondCheck requests a silent native roll and stores one authored inline receipt', async () => {
    await respondCheck(env.root.id, env.actor.uuid);
    assert.equal(env.nativeCalls.length, 1);
    assert.equal(env.nativeCalls[0].chat, false);
    assert.equal(env.nativeCalls[0].modifier, 15);
    assert.equal(env.created.length, 1);
    const response = env.created[0].getFlag('riftan-charbar', 'partyResponse');
    assert.equal(env.created[0].author.id, env.player.id);
    assert.equal(response.requestedModifier, 10);
    assert.equal(response.appliedModifier, 15);
    assert.equal(response.roll, 59);
    assert.equal(response.target, 45);
    assert.match(response.modifiers, /Броня Авенджер.*\+10/);
    assert.match(env.cards.get(env.root.id).body.innerHTML, /1 степень провала/);
    assert.match(env.cards.get(env.root.id).body.innerHTML, /Броня Авенджер.*\+10/);
    assert.equal(env.cards.get(env.created[0].id).hidden, true);
    await respondCheck(env.root.id, env.actor.uuid);
    assert.equal(env.nativeCalls.length, 1, 'retries reuse the accepted response');
});

test('cancelling or closing the request during the dialog creates no roll or receipt', async () => {
    env.chosen = null;
    await respondCheck(env.root.id, env.actor.uuid);
    assert.equal(env.nativeCalls.length, 0);
    foundry.applications.api.DialogV2.prompt = async () => {
        env.root.flags['riftan-charbar'].partyRequest = {...env.request, closed:true};
        return {modifier:15, difficulty:0};
    };
    await respondCheck(env.root.id, env.actor.uuid);
    assert.equal(env.nativeCalls.length, 0);
    assert.equal(env.created.length, 0);
});
