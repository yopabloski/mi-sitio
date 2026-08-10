export const genres=['Pop','Rock','Rap','Trap Latino'];
export const days=[
  {id:'friday',name:'Viernes',artistCount:6,budget:24,duration:10,minChilean:1,minGenres:4,genreMinimums:{}},
  {id:'saturday',name:'Sábado',artistCount:7,budget:28,duration:12,minChilean:2,minGenres:4,genreMinimums:{Rock:2}},
  {id:'sunday',name:'Domingo',artistCount:8,budget:28,duration:12,minChilean:3,minGenres:4,genreMinimums:{Pop:2,Rock:2,Rap:2,'Trap Latino':2}}
];
export function totals(ids,artists){const chosen=ids.map(id=>artists.find(a=>a.id===id)).filter(Boolean);return{count:chosen.length,cost:chosen.reduce((s,a)=>s+a.cost,0),duration:chosen.reduce((s,a)=>s+a.duration,0),score:chosen.reduce((s,a)=>s+a.popularity,0),chilean:chosen.filter(a=>a.country==='CHI').length,genres:Object.fromEntries(genres.map(g=>[g,chosen.filter(a=>a.genre===g).length]))}}
export function validate(ids,day,artists){const t=totals(ids,artists),checks=[['Artistas',t.count===day.artistCount,`${t.count} / ${day.artistCount}`],['Presupuesto',t.cost<=day.budget,`${t.cost} / ${day.budget}`],['Duración',t.duration<=day.duration,`${t.duration} / ${day.duration} h`],['Talento chileno',t.chilean>=day.minChilean,`${t.chilean} / ${day.minChilean} mín.`],['Diversidad',Object.values(t.genres).filter(Boolean).length>=day.minGenres,`${Object.values(t.genres).filter(Boolean).length} / ${day.minGenres}`]];for(const [g,min] of Object.entries(day.genreMinimums||{}))checks.push([g,t.genres[g]>=min,`${t.genres[g]} / ${min} mín.`]);return{totals:t,checks,valid:checks.every(x=>x[1])}}
export const defaultSession=()=>({code:'DEMO',name:'MusicFest Demo',mode:'sequential',state:'lobby',activeDayIndex:0,revision:1,days,artistIds:[],updatedAt:new Date().toISOString()});
