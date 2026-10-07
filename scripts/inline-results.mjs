export function responseFromRoll(meta,data){
 if(!meta?.requestId||!data)return null;
 return {...meta,actorUuid:data.actorUuid,roll:Number(data.result),target:Number(data.target?.final),success:!!data.flags?.isSuccess,degrees:Number(data.flags?.isSuccess?data.dos:data.dof),base:Number(data.target?.base),totalModifier:Number(data.target?.modifier)};
}
export function resultLabel(response,language='ru'){
 const n=Math.abs(response.degrees);
 if(!language.startsWith('ru'))return `${n} degree${n===1?'':'s'} of ${response.success?'success':'failure'}`;
 const form=n%10===1&&n%100!==11?'степень':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'степени':'степеней';
 return `${n} ${form} ${response.success?'успеха':'провала'}`;
}
export function boundedPosition(position,width,height,viewportWidth,viewportHeight){
 return {x:Math.max(0,Math.min(Number(position.x)||0,Math.max(0,viewportWidth-width))),y:Math.max(0,Math.min(Number(position.y)||0,Math.max(0,viewportHeight-height)))};
}
