importScripts('vendor-solver.js');

const START='troy',END='ithaca';

function heldKarp(nodes,matrix){
 const middle=nodes.filter(id=>id!==START&&id!==END),m=middle.length;
 if(!m)return{value:matrix[START][END],route:[START,END],method:'programación dinámica exacta'};
 const states=1<<m,size=states*m,dp=new Float64Array(size),parent=new Int16Array(size);dp.fill(Infinity);parent.fill(-1);
 for(let j=0;j<m;j++)if(matrix[START][middle[j]]!=null)dp[(1<<j)*m+j]=matrix[START][middle[j]];
 for(let mask=1;mask<states;mask++)for(let j=0;j<m;j++)if(mask&(1<<j)){
  const prevMask=mask^(1<<j);if(!prevMask)continue;let best=Infinity,bestK=-1;
  for(let k=0;k<m;k++)if(prevMask&(1<<k)&&matrix[middle[k]][middle[j]]!=null){const candidate=dp[prevMask*m+k]+matrix[middle[k]][middle[j]];if(candidate<best){best=candidate;bestK=k}}
  dp[mask*m+j]=best;parent[mask*m+j]=bestK;
 }
 const full=states-1;let value=Infinity,last=-1;
 for(let j=0;j<m;j++)if(matrix[middle[j]][END]!=null){const candidate=dp[full*m+j]+matrix[middle[j]][END];if(candidate<value){value=candidate;last=j}}
 if(!Number.isFinite(value))return null;
 const reverse=[];let mask=full;
 while(last>=0){reverse.push(middle[last]);const previous=parent[mask*m+last];mask^=1<<last;last=previous}
 return{value:+value.toFixed(1),route:[START,...reverse.reverse(),END],method:'programación dinámica exacta'};
}

function milpModel(nodes,matrix){
 const middle=nodes.filter(id=>id!==START&&id!==END),n=nodes.length,model={optimize:'objective',opType:'min',constraints:{},variables:{},binaries:{},ints:{},timeout:12000};
 for(const i of nodes)if(i!==END)model.constraints[`out__${i}`]={equal:1};
 for(const j of nodes)if(j!==START)model.constraints[`in__${j}`]={equal:1};
 for(const i of middle){model.constraints[`lb__${i}`]={min:1};model.constraints[`ub__${i}`]={max:n-2};model.variables[`u__${i}`]={[`lb__${i}`]:1,[`ub__${i}`]:1};model.ints[`u__${i}`]=1}
 for(const i of middle)for(const j of middle)if(i!==j)model.constraints[`mtz__${i}__${j}`]={max:n-2};
 for(const i of nodes)for(const j of nodes){if(i===j||i===END||j===START||matrix[i][j]==null)continue;const key=`x__${i}__${j}`,variable={objective:matrix[i][j],[`out__${i}`]:1,[`in__${j}`]:1};if(middle.includes(i)&&middle.includes(j))variable[`mtz__${i}__${j}`]=n-1;model.variables[key]=variable;model.binaries[key]=1}
 for(const i of middle)for(const j of middle)if(i!==j){model.variables[`u__${i}`][`mtz__${i}__${j}`]=1;model.variables[`u__${j}`][`mtz__${i}__${j}`]=-1}
 return model;
}

function solveMilp(nodes,matrix){
 const result=solver.Solve(milpModel(nodes,matrix));if(!result.feasible)return null;
 const next={};for(const [key,value]of Object.entries(result))if(key.startsWith('x__')&&value>.5){const[,from,to]=key.split('__');next[from]=to}
 const route=[START];while(route.at(-1)!==END&&route.length<=nodes.length)route.push(next[route.at(-1)]);
 return route.length===nodes.length?{value:+result.result.toFixed(1),route,method:'programación entera mixta'}:null;
}

onmessage=e=>{const{nodes,matrix}=e.data;let answer=null;if(nodes.length<=6)answer=solveMilp(nodes,matrix);answer=answer||heldKarp(nodes,matrix);postMessage(answer||{error:'No existe una ruta completa con las conexiones habilitadas.'})};
