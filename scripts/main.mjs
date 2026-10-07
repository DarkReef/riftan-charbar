import {responseFromRoll,resultLabel} from './inline-results.mjs';
import {renderTokenBar} from './token-bar.mjs';
import {registerWeaponHUD} from './token-weapons.mjs';
Hooks.once('ready',registerWeaponHUD);
import {validateRequest, canRespond, acceptedResponses, targetActors} from './requests.mjs';

const SCOPE = 'riftan-charbar';
const esc = value => foundry.utils.escapeHTML(String(value ?? ''));
const t = key => game.i18n.localize(`RIFTAN_CHARBAR.${key}`);
const errorText = error => {
    const keys = {'Container cycle':'CYCLE','Container capacity exceeded':'CAPACITY_ERROR','Invalid money':'INVALID_MONEY',
        'Single container required':'SINGLE_CONTAINER','Physical item required':'UNKNOWN_ITEM'};
    return keys[error.message] ? t(keys[error.message]) : error.message;
};
const actorFrom = uuid => fromUuidSync(uuid);
const responding = new Set();
let panel;
const refreshBar=()=>renderTokenBar({actors,open:openPartyPanel,request:tokens=>requestDialog(targetActors(tokens))});
Hooks.once('init',()=>game.settings.register(SCOPE,'compactBar',{name:'RIFTAN_CHARBAR.COMPACT_BAR',scope:'client',config:true,type:Boolean,default:true,onChange:refreshBar}));
Hooks.once('init',()=>game.settings.register(SCOPE,'barPosition',{scope:'client',config:false,type:Object,default:null}));
function owned(actor) { if (!actor?.isOwner && !game.user.isGM) throw new Error(t('NO_PERMISSION')); }
function actors() {
    const result = new Map();
    for (const token of canvas.tokens?.placeables ?? []) {
        const actor = token.actor;
        if (actor && (game.user.isGM ? !token.document.hidden && actor.hasPlayerOwner : actor.isOwner)) result.set(actor.uuid, actor);
    }
    for (const user of game.users) if (user.character && (game.user.isGM || user.character.isOwner)) result.set(user.character.uuid, user.character);
    for (const token of canvas.tokens?.controlled ?? []) if (token.actor && (game.user.isGM || token.actor.isOwner)) result.set(token.actor.uuid, token.actor);
    return [...result.values()];
}
function responses(message, request) {
    return acceptedResponses(game.messages.contents, message.id, request, actorFrom, id => game.users.get(id));
}
function requestHTML(message, request) {
    const result = responses(message, request);
    return `<section class="dh-party-request"><h3>${esc(t('REQUEST'))}: ${esc(request.label)}</h3><p>${esc(request.reason)} (${esc(t('DIFFICULTY'))}: ${Number(request.difficulty)||0}; ${esc(t('MODIFIER'))}: ${request.modifier >= 0 ? '+' : ''}${request.modifier})</p>
        ${request.actorUuids.map(uuid => {
            const actor = actorFrom(uuid), response = result.get(uuid);
            return `<div>${esc(actor?.name ?? t('MISSING_ACTOR'))}: ${response ? `<span class="riftan-inline-result ${response.success?'success':'failure'}" tabindex="0" title="${esc(`${response.roll}/${response.target}; ${t('MODIFIER')}: ${response.requestedModifier??request.modifier} → ${response.appliedModifier??request.modifier}; ${t('DIFFICULTY')}: ${response.requestedDifficulty??request.difficulty??0} → ${response.appliedDifficulty??request.difficulty??0}; ${t('TOTAL_MODIFIER')}: ${response.totalModifier??'—'}`)}">${esc(resultLabel(response,game.i18n.lang))}</span>`
                : `<button type="button" data-party-roll="${esc(uuid)}" ${canRespond(request, actor, game.user) ? '' : 'disabled'}>${esc(t(request.closed ? 'CLOSED' : 'ROLL'))}</button>`}</div>`;
        }).join('')}${game.user.isGM && !request.closed ? `<button type="button" data-party-close>${esc(t('CLOSE_REQUEST'))}</button>` : ''}</section>`;
}
export async function requestChecks(input) {
    if (!game.user.isGM) throw new Error(t('GM_ONLY'));
    const request = {...validateRequest(input), reason:String(input.reason ?? '').slice(0,500), closed:false};
    for (const uuid of request.actorUuids) {
        const actor = await fromUuid(uuid);
        if (!actor || !(request.characteristic ? actor.characteristics?.[request.characteristic] : actor.skills?.[request.skill])) throw new Error(t('UNKNOWN_TEST'));
    }
    const first = await fromUuid(request.actorUuids[0]);
    request.label = game.i18n.localize((request.characteristic ? first.characteristics[request.characteristic] : first.skills[request.skill]).label || request.characteristic || request.skill);
    return ChatMessage.create({content:`<p>${esc(t('REQUEST'))}: ${esc(request.label)}</p>`, flags:{[SCOPE]:{partyRequest:request}}});
}
export async function respondCheck(messageId, actorUuid) {
    const key = `${messageId}:${actorUuid}`;
    if (responding.has(key)) return;
    responding.add(key);
    try {
        const message = game.messages.get(messageId), request = message?.getFlag(SCOPE, 'partyRequest');
        const actor = await fromUuid(actorUuid);
        if (!message?.author?.isGM || !canRespond(request, actor, game.user)) throw new Error(t('NO_PERMISSION'));
        if (responses(message, request).has(actorUuid)) return;
        const chosen=await foundry.applications.api.DialogV2.prompt({window:{title:request.label},content:`<div class="dh-party-form"><p>${esc(request.reason)}</p><label>${esc(t('DIFFICULTY'))}<input name="difficulty" type="number" min="-60" max="60" value="${Number(request.difficulty)||0}"></label><label>${esc(t('MODIFIER'))}<input name="modifier" type="number" min="-1000" max="1000" value="${request.modifier}"></label></div>`,rejectClose:false,ok:{label:t('ROLL'),callback:(_e,b)=>({difficulty:Number(b.form.elements.difficulty.value),modifier:Number(b.form.elements.modifier.value)})}});
        if(!chosen)return;
        const checked=validateRequest({...request,...chosen});
        const current=message.getFlag(SCOPE,'partyRequest');
        if(!canRespond(current,actor,game.user)||responses(message,current).has(actorUuid))return;
        if(!game.darkHeresy.api.supportsRollMessageFlags)throw new Error(t('UPDATE_SYSTEM'));
        const metadata={requestId:messageId,actorUuid,requestedModifier:request.modifier,requestedDifficulty:request.difficulty??0,appliedModifier:checked.modifier,appliedDifficulty:checked.difficulty};
        await game.darkHeresy.api.rollTest({actorUuid,characteristic:request.characteristic,skill:request.skill,modifier:checked.modifier+checked.difficulty,dialog:false,messageFlags:{[SCOPE]:{requestRoll:metadata}}});
    } finally { responding.delete(key); }
}
export function openPartyPanel() { return panel?.render(true); }

function bind(app, handler) {
    app.element.querySelector('.dh-party-content').addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        event.preventDefault(); button.disabled = true;
        Promise.resolve(handler(button.dataset.action, button)).catch(error => ui.notifications.error(errorText(error)))
            .finally(() => { button.disabled = false; });
    });
}
function createApplications() {
    const {ApplicationV2} = foundry.applications.api;
    class BasePanel extends ApplicationV2 {
        static DEFAULT_OPTIONS = {classes:['dark-heresy','dh-party-app'], position:{width:760,height:520}, window:{resizable:true}};
        _replaceHTML(result, content) { content.innerHTML = result; }
    }
    class PartyPanel extends BasePanel {
        static DEFAULT_OPTIONS = {id:'riftan-charbar', window:{title:'RIFTAN_CHARBAR.TITLE'}};
        constructor(...args) {super(...args); this.selected = null;}
        async _renderHTML() {
            const list = actors();
            return `<div class="dh-party-content"><div class="dh-party-toolbar"><button data-action="refresh">${esc(t('REFRESH'))}</button>
                ${game.user.isGM ? `<button data-action="request">${esc(t('REQUEST'))}</button>${game.modules.get("itempileffg")?.api ? `<button data-action="merchant">${esc(t("MAKE_MERCHANT"))}</button>` : ""}` : ''}</div>
                <div class="dh-party-roster">${list.map(actor => {
                    const s = actor.system;
                    const states = [...actor.effects].filter(e => !e.disabled && !e.isSuppressed && e.statuses?.size).map(e => e.name).join(', ');
                    return `<article data-actor="${esc(actor.uuid)}"><input type="checkbox" name="recipient" value="${esc(actor.uuid)}" ${this.selected === null || this.selected.has(actor.uuid) ? 'checked' : ''}>
                        <img src="${esc(actor.img)}" alt=""><div><strong>${esc(actor.name)}</strong><p>${esc(t('WOUNDS'))}: ${Number(s.wounds?.value) || 0}/${Number(s.wounds?.max) || 0} · ${esc(t('CRITICAL'))}: ${Number(s.wounds?.critical) || 0}<br>
                        ${esc(t('FATIGUE'))}: ${Number(s.fatigue?.value) || 0}/${Number(s.fatigue?.max) || 0} · ${esc(t('FATE'))}: ${Number(s.fate?.value) || 0}/${Number(s.fate?.max) || 0}<br>${esc(states || t('NO_CONDITIONS'))}</p></div>
                        <div class="dh-party-actions"><button data-action="sheet">${esc(t('SHEET'))}</button>${game.modules.get("itempileffg")?.api ? `<button data-action="inventory">${esc(t("INVENTORY"))}</button>` : ""}<button data-action="condition">${esc(t('CONDITION'))}</button></div></article>`;
                }).join('') || `<p>${esc(t('EMPTY'))}</p>`}</div><p>${esc(t('REQUEST_HINT'))}</p></div>`;
        }
        _onRender(context, options) {
            super._onRender(context, options);
            this.element.querySelectorAll('[name=recipient]').forEach(input => input.addEventListener('change', () => {
                this.selected = new Set([...this.element.querySelectorAll('[name=recipient]:checked')].map(i => i.value));
            }));
            bind(this, async (action, button) => {
                const actor = actorFrom(button.closest('[data-actor]')?.dataset.actor);
                if (action === 'refresh') return this.render(true);
                if (action === 'sheet') return actor.sheet.render(true);
                if (action === 'inventory') return game.modules.get('itempileffg')?.api?.openInventory(actor);
                if (action === 'condition') return conditionDialog(actor);
                if (action === 'merchant') return game.modules.get('itempileffg')?.api?.createMerchantFromSelected();
                if (action === 'request') {
                    const recipients = [...this.element.querySelectorAll('[name=recipient]:checked')].map(input => input.value);
                    return requestDialog(recipients);
                }
            });
        }
    }
    panel = new PartyPanel();
}
async function requestDialog(actorUuids) {
    if (!actorUuids.length) throw new Error(t('SELECT_ACTORS'));
    const actor = actorFrom(actorUuids[0]);
    const options = [...Object.entries(actor.characteristics ?? {}).map(([key,value]) => [`c:${key}`,value.label ?? key]),
        ...Object.entries(actor.skills ?? {}).filter(([,value])=>!value.isSpecialist).map(([key,value]) => [`s:${key}`,value.label ?? key])];
    return foundry.applications.api.DialogV2.prompt({window:{title:t('REQUEST')},content:`<div class="dh-party-form"><label>${esc(t('TEST'))}<select name="test">${options.map(([key,label]) => `<option value="${esc(key)}">${esc(game.i18n.localize(label))}</option>`).join('')}</select></label>
        <label>${esc(t('DIFFICULTY'))}<select name="difficulty">${[60,50,40,30,20,10,0,-10,-20,-30,-40,-50,-60].map(n=>`<option value="${n}" ${n===0?'selected':''}>${n>0?'+':''}${n}</option>`).join('')}</select></label><label>${esc(t('MODIFIER'))}<input name="modifier" type="number" value="0"></label><label>${esc(t('REASON'))}<input name="reason" maxlength="500"></label></div>`,
        ok:{label:t('REQUEST'),callback:(_event,button) => {
            const form = button.form, [type,key] = form.elements.test.value.split(':');
            return requestChecks({actorUuids,characteristic:type==='c'?key:'',skill:type==='s'?key:'',modifier:form.elements.modifier.value,difficulty:form.elements.difficulty.value,reason:form.elements.reason.value});
        }}});
}
async function conditionDialog(actor) {
    owned(actor);
    return foundry.applications.api.DialogV2.prompt({window:{title:t('CONDITION')},content:`<div class="dh-party-form"><select name="condition">${CONFIG.statusEffects.map(e => `<option value="${esc(e.id)}">${esc(game.i18n.localize(e.name ?? e.label))}</option>`).join('')}</select><label><input type="checkbox" name="active" checked>${esc(t('ACTIVE'))}</label><label>${esc(t('ROUNDS'))}<input type="number" name="rounds" value="1" min="1" step="1"></label></div>`,
        ok:{callback:(_event, button) => game.darkHeresy.api.applyCondition({actorUuid:actor.uuid,condition:button.form.elements.condition.value,active:button.form.elements.active.checked,rounds:Number(button.form.elements.rounds.value)})}});
}
Hooks.once('ready', () => {
    if (!game.darkHeresy?.api?.rollTest) {ui.notifications.error('Riftan Charbar requires Apex Heresy API v1 (1.4.2 or later).'); return;}
    createApplications();
    refreshBar();
    const api = {version:1, open:openPartyPanel, requestChecks, respondCheck};
    game.riftanCharbar = api; game.modules.get(SCOPE).api = api;
    for (const hook of ['updateActor','createItem','updateItem','deleteItem','createActiveEffect','updateActiveEffect','deleteActiveEffect','updateUser','canvasReady','controlToken','targetToken','createToken','deleteToken','updateToken']) Hooks.on(hook, () => {
        if (panel?.rendered) panel.render(true);
        refreshBar();
    });
});
Hooks.on('canvasTearDown',()=>document.getElementById('riftan-token-bar')?.remove());
Hooks.on('getSceneControlButtons', controls => {
    if (!controls.tokens?.tools) return;
    controls.tokens.tools.riftanCharbar = {name:'riftanCharbar',title:'RIFTAN_CHARBAR.TITLE',icon:'fa-solid fa-users',order:95,button:true,onChange:openPartyPanel};
});
Hooks.on('renderChatMessageHTML', (message, html) => {
    const inline=message.getFlag(SCOPE,'partyResponse');
    const parent=inline&&game.messages.get(inline.requestId);
    if(inline&&message.getFlag(SCOPE,'requestRoll')&&parent?.author?.isGM&&parent.visible!==false&&parent.isContentVisible!==false&&responses(parent,parent.getFlag(SCOPE,'partyRequest')).has(inline.actorUuid)){html.hidden=true;html.style.display='none';return;}
    const request = message.getFlag(SCOPE,'partyRequest');
    if (!request || !message.author?.isGM) return;
    const body = html.querySelector('.message-content');
    if (!body) return;
    body.innerHTML = requestHTML(message,request);
    body.querySelectorAll('[data-party-roll]').forEach(button => button.addEventListener('click', async () => {
        button.disabled = true;
        try {await respondCheck(message.id,button.dataset.partyRoll);} catch(error) {ui.notifications.error(error.message);}
        finally {ui.chat?.render(true);}
    }));
    body.querySelector('[data-party-close]')?.addEventListener('click', async () => {
        if (game.user.isGM) await message.setFlag(SCOPE,'partyRequest',{...request,closed:true});
    });
});
Hooks.on('createChatMessage', message => { if (message.getFlag(SCOPE,'partyResponse')) ui.chat?.render(true); });

// Make native check cards reliable on unmodified 1.4.2 as well as the RU fork.
Hooks.on('preCreateChatMessage', (message, data) => {
    const roll = message.getFlag('dark-heresy','rollData');
    const metadata=message.getFlag(SCOPE,'requestRoll');
    if(metadata&&roll){const parent=game.messages.get(metadata.requestId),request=parent?.getFlag(SCOPE,'partyRequest'),actor=actorFrom(roll.actorUuid);
      if(!parent?.author?.isGM||!canRespond(request,actor,game.user))return false;
      message.updateSource({['flags.'+SCOPE+'.partyResponse']:responseFromRoll(metadata,roll)});
    }
    if (!roll?.actorUuid) return;
    const actor = fromUuidSync(roll.actorUuid);
    if (!actor) return;
    const patch = {speaker:{actor:actor.id,alias:actor.name,scene:actor.token?.parent?.id ?? canvas?.scene?.id ?? null,token:actor.token?.id ?? null}};
    const nextRoll = {...roll};
    if (actor.token) nextRoll.tokenId = actor.token.id; else delete nextRoll.tokenId;
    patch['flags.dark-heresy.rollData'] = nextRoll;
    ChatMessage.applyRollMode(patch, data.rollMode ?? game.settings.get('core','rollMode'));
    message.updateSource(patch);
});
