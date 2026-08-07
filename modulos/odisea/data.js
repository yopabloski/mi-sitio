window.ODYSSEY_DATA=(()=>{
 const raw=[
  ['troy','Troya','TR',92,49,0],['ithaca','Ítaca','IT',72,50,0],
  ['ismarus','Ísmaro','IS',86,33,1],['cape_malea','Cabo Malea','CM',77,64,2],
  ['cythera','Citera','CT',74,74,3],['lotophagi','Lotófagos','LO',30,87,4],
  ['cyclopes','Cíclopes','CL',50,60,5],['aeolia','Eolia','EO',42,72,6],
  ['lamos','Lamos','LA',22,75,7],['aeaea','Eea','EE',15,46,8],
  ['cimmerians','Cimerios','CR',10,31,9],['sirens','Sirenas','SI',34,48,10],
  ['scylla','Escila','ES',56,53,11],['charybdis','Caribdis','CA',57,64,12],
  ['thrinacia','Trinacia','TN',50,78,13],['ogygia','Ogigia','OG',10,59,14],
  ['scheria','Esqueria','EQ',33,33,15]
 ];
 const places=raw.map(([id,name,short,x,y,order])=>({id,name,short,x,y,order,required:id==='troy'||id==='ithaca'}));
 const lore={
  troy:{name:'Troya',kind:'Ciudad histórica · punto de partida',book:'Antecedente; relatado en los libros 8–9',story:'Tras diez años de guerra, Odiseo parte de Troya con doce naves para regresar a Ítaca.',modern:'Yacimiento de Hisarlık, cerca de Tevfikiye, Turquía.'},
  ithaca:{name:'Ítaca',kind:'Isla y reino · destino final',book:'Libros 13–24',story:'Odiseo vuelve disfrazado, prueba la lealtad de los suyos y recupera su casa enfrentándose a los pretendientes.',modern:'Ítaca es una isla y municipio actuales de Grecia, aunque la geografía homérica sigue siendo debatida.'},
  ismarus:{name:'Ísmaro',kind:'Ciudad de los cícones',book:'Libro 9',story:'Los aqueos saquean la ciudad, pero tardan en retirarse. Los cícones contraatacan y Odiseo pierde seis hombres de cada nave.',modern:'Se asocia con la región de Maroneia, en Tracia, noreste de Grecia.'},
  cape_malea:{name:'Cabo Malea',kind:'Cabo real · peligro marítimo',book:'Libro 9',story:'Al doblar Malea, una tormenta y el viento del norte desvían a la flota de su ruta hacia Ítaca.',modern:'Cabo Malea existe en el extremo sudoriental del Peloponeso, Grecia.'},
  cythera:{name:'Citera',kind:'Isla real',book:'Libro 9',story:'Los vientos arrastran a Odiseo más allá de Citera y lo alejan del mundo griego conocido.',modern:'Kythira es una isla y municipio actuales de Grecia.'},
  lotophagi:{name:'Lotófagos',kind:'Pueblo y territorio mítico',book:'Libro 9',story:'Quienes comen el loto olvidan el deseo de regresar. Odiseo obliga a sus hombres a volver a las naves.',modern:'La tradición suele situarlo en el norte de África, a veces en Yerba, Túnez; no hay identificación segura.'},
  cyclopes:{name:'Cíclopes',kind:'Territorio mítico',book:'Libro 9',story:'Polifemo encierra a la tripulación y devora a varios hombres. Odiseo lo ciega y escapa bajo sus carneros.',modern:'La asociación con Sicilia es tradicional, no una localización demostrada.'},
  aeolia:{name:'Eolia',kind:'Isla mítica de Eolo',book:'Libro 10',story:'Eolo entrega a Odiseo una bolsa con los vientos. La tripulación la abre a la vista de Ítaca y la nave vuelve a ser desviada.',modern:'Suele relacionarse con las islas Eolias, especialmente Lipari, Italia; la isla homérica es fabulosa.'},
  lamos:{name:'Lamos',kind:'Ciudad de los lestrigones',book:'Libro 10',story:'Los gigantes caníbales lestrigones destruyen todas las naves salvo la de Odiseo y matan a gran parte de la tripulación.',modern:'Su ubicación es incierta; distintas tradiciones la sitúan en Sicilia o Cerdeña.'},
  aeaea:{name:'Eea',kind:'Isla mítica de Circe',book:'Libros 10 y 12',story:'Circe transforma a los compañeros en cerdos. Odiseo vence su magia, permanece un año y recibe instrucciones para continuar.',modern:'Se ha asociado con el promontorio del Circeo o Ponza, Italia, sin consenso.'},
  cimmerians:{name:'Cimerios',kind:'Pueblo en el confín mítico',book:'Libro 11',story:'En una tierra sin sol, Odiseo realiza el rito para consultar a Tiresias y conversa con los muertos.',modern:'No corresponde con seguridad a una ciudad moderna; su posición en el poema es cosmológica y mítica.'},
  sirens:{name:'Sirenas',kind:'Escenario mítico',book:'Libro 12',story:'La tripulación se tapa los oídos con cera y ata a Odiseo al mástil para que pueda escuchar el canto sin sucumbir.',modern:'Se asocia tradicionalmente con las islas Sirenuse, frente a Campania, Italia.'},
  scylla:{name:'Escila',kind:'Monstruo marino',book:'Libro 12',story:'El monstruo de seis cabezas arrebata y devora a seis compañeros mientras la nave atraviesa el estrecho.',modern:'La tradición la ubica en el lado calabrés del estrecho de Mesina, Italia.'},
  charybdis:{name:'Caribdis',kind:'Remolino monstruoso',book:'Libro 12',story:'Caribdis traga y devuelve enormes masas de agua. Odiseo debe navegar entre este peligro y Escila.',modern:'Se asocia con las corrientes del estrecho de Mesina, entre Sicilia y Calabria.'},
  thrinacia:{name:'Trinacia',kind:'Isla mítica del Sol',book:'Libro 12',story:'La tripulación sacrifica el ganado sagrado de Helios pese a la prohibición. Zeus destruye la nave y solo Odiseo sobrevive.',modern:'A menudo se identifica con Sicilia, pero el texto no permite asegurarlo.'},
  ogygia:{name:'Ogigia',kind:'Isla mítica de Calipso',book:'Libros 1 y 5',story:'Calipso retiene a Odiseo durante siete años hasta que, por orden de Zeus, le permite construir una balsa y partir.',modern:'Se ha asociado con Gozo, Malta, entre otras propuestas; ninguna es concluyente.'},
  scheria:{name:'Esqueria',kind:'Reino mítico de los feacios',book:'Libros 6–8',story:'Nausícaa auxilia a Odiseo. En la corte de Alcínoo, el héroe relata sus aventuras y recibe la nave que lo lleva a Ítaca.',modern:'La tradición suele relacionarla con Corfú, Grecia; Esqueria pertenece al paisaje mítico del poema.'}
 };
 places.forEach(p=>Object.assign(p,lore[p.id]||{}));
 const hash=(a,b,s=17)=>{let n=s;for(const c of a+b)n=(n*31+c.charCodeAt(0))%997;return n};
 const pairHash=(a,b,s=17)=>{const pair=[a,b].sort();return hash(pair[0],pair[1],s)};
 const geometricDistance=(a,b)=>Math.max(35,Math.round(Math.hypot((a.x-b.x)*1.775,a.y-b.y)*6.2));
 const hazards={troy:2,ithaca:1,ismarus:5,cape_malea:6,cythera:4,lotophagi:5,cyclopes:9,aeolia:6,lamos:9,aeaea:6,cimmerians:8,sirens:9,scylla:10,charybdis:10,thrinacia:8,ogygia:5,scheria:2};
 const calmValue=(metric,a,b)=>{const distance=geometricDistance(a,b),variation=(pairHash(a.id,b.id,29)%9-4)/100;if(metric==='distance')return Math.round(distance*(1+variation));if(metric==='time')return +(distance/78*(1+variation*.7)+.35).toFixed(1);return Math.max(1,Math.round(distance/85+(hazards[a.id]+hazards[b.id])/4+pairHash(a.id,b.id,43)%5))};
 const windFactor=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,projection=(dx*.82+dy*.57)/length;return Math.max(.68,Math.min(1.58,1-projection*.34+(hash(a.id,b.id,61)%15-7)/100))};
 const windyValue=(metric,a,b)=>{const base=calmValue(metric,a,b),factor=windFactor(a,b);if(metric==='distance')return Math.round(base*factor);if(metric==='time')return +(base*Math.pow(factor,1.28)+(hash(a.id,b.id,71)%8)/10).toFixed(1);return Math.max(1,Math.round(base*factor+(hash(a.id,b.id,83)%6)))};
 const canonical=['troy',...places.filter(p=>!p.required).sort((a,b)=>a.order-b.order).map(p=>p.id),'ithaca'],rank=Object.fromEntries(canonical.map((id,i)=>[id,i]));
 const forbidden=(a,b)=>{if(rank[a.id]<rank[b.id])return false;const close=geometricDistance(a,b)<260;return close||hash(a.id,b.id,97)%100<28};
 const matrix=(metric,round)=>Object.fromEntries(places.map(a=>[a.id,Object.fromEntries(places.map(b=>{if(a.id===b.id)return[b.id,0];if(round===3&&forbidden(a,b))return[b.id,null];return[b.id,round===1?calmValue(metric,a,b):windyValue(metric,a,b)]}))]));
 const roundInfo=[['Mar de bruma','El mar está en calma. Las rutas de ida y vuelta tienen las mismas condiciones y los valores siguen la geografía del mapa.'],['Vientos contrarios','Eolo ha soltado los vientos. La distancia navegada, el tiempo y el peligro dependen de la dirección del viaje.'],['La ira de Poseidón','Poseidón ha cerrado pasos y estrechos. Algunas conexiones ya no están disponibles y la flota debe aceptar rutas más largas y peligrosas.']];
 const rounds=roundInfo.map(([title,story],i)=>({id:i+1,title,story,matrices:Object.fromEntries(['distance','time','danger'].map(metric=>[metric,matrix(metric,i+1)]))}));
 return{places,rounds,metrics:{distance:['Distancia navegada','mn'],time:['Tiempo','días'],danger:['Peligro','pts']},score(route,round,metric){let total=0,legs=[],feasible=true;for(let i=0;i<route.length-1;i++){const value=round.matrices[metric][route[i]][route[i+1]];if(value==null)feasible=false;else total+=value;legs.push({from:route[i],to:route[i+1],value})}return{total:feasible?+total.toFixed(1):null,legs,feasible}}}
})();
