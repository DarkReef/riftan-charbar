import {test} from 'node:test';
import assert from 'node:assert/strict';
import {responseFromRoll,resultLabel,boundedPosition} from '../scripts/inline-results.mjs';
test('request result uses native roll degrees and preserves modifier details',()=>{
 const result=responseFromRoll({requestId:'r',appliedModifier:10},{actorUuid:'Actor.a',result:48,target:{final:40,modifier:10},flags:{isSuccess:false},dof:1});
 assert.equal(resultLabel(result),'1 степень провала');assert.equal(result.roll,48);assert.equal(result.target,40);assert.equal(result.appliedModifier,10);
 for(const [n,expected] of [[2,'2 степени успеха'],[5,'5 степеней успеха'],[11,'11 степеней успеха'],[21,'21 степень успеха']])assert.equal(resultLabel({degrees:n,success:true}),expected);
});
test('saved panel position remains reachable on smaller viewports',()=>{
 assert.deepEqual(boundedPosition({x:1000,y:900},220,60,800,600),{x:580,y:540});
 assert.deepEqual(boundedPosition({x:-10,y:-3},900,60,800,600),{x:0,y:0});
});
