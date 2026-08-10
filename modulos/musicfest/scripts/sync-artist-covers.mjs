import {writeFile} from 'node:fs/promises';
import {artists,artwork as approvedArtwork} from '../js/data/artists.js';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/\bthe\b/g,'').replace(/[^a-z0-9]/g,'');
const approvedInfo={
  'denise-rosenthal':{album:'Supernova',year:'2023',url:'https://music.apple.com/cl/album/supernova/1708989470',review:'approved'},
  'los-bunkers':{album:'Los Bunkers MTV Unplugged',year:'2024',url:'https://music.apple.com/cl/album/los-bunkers-mtv-unplugged/1781795068',review:'approved'},
  'kendrick-lamar':{album:'GNX',year:'2024',url:'https://music.apple.com/cl/album/gnx/1781316864',review:'approved'},
  'bad-bunny':{album:'DeBÍ TiRAR MáS FOToS',year:'2025',url:'https://music.apple.com/cl/album/deb%C3%AD-tirar-m%C3%A1s-fotos/1787022393',review:'approved'}
};
const coverMap={...approvedArtwork},releaseInfo={...approvedInfo},unresolved=[];

for(const [index,artist] of artists.entries()){
  if(coverMap[artist.id]){console.log(`[${index+1}/${artists.length}] ${artist.name} · aprobada`);continue}
  try{
    const endpoint=`https://itunes.apple.com/search?term=${encodeURIComponent(artist.name)}&media=music&entity=album&attribute=artistTerm&country=cl&limit=50`;
    const response=await fetch(endpoint,{headers:{'User-Agent':'MusicFest-Educational/1.0'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json(),target=normalize(artist.name);
    const matches=data.results.filter(item=>item.artworkUrl100&&(item.trackCount||0)>=4).filter(item=>{const candidate=normalize(item.artistName);return candidate===target||candidate.includes(target)||target.includes(candidate)}).sort((a,b)=>new Date(b.releaseDate)-new Date(a.releaseDate));
    const match=matches[0];
    if(!match){unresolved.push(artist);console.log(`[${index+1}/${artists.length}] ${artist.name} · sin coincidencia`)}
    else{
      coverMap[artist.id]=match.artworkUrl100.replace('100x100bb','600x600bb');
      releaseInfo[artist.id]={album:match.collectionName,year:String(match.releaseDate||'').slice(0,4),url:match.collectionViewUrl,review:'pending'};
      console.log(`[${index+1}/${artists.length}] ${artist.name} · ${match.collectionName}`);
    }
  }catch(error){unresolved.push(artist);console.log(`[${index+1}/${artists.length}] ${artist.name} · error ${error.message}`)}
  if(index<artists.length-1)await pause(3100);
}

const banner='// Generado por scripts/sync-artist-covers.mjs · revisar antes de producción.\n';
const output=`${banner}export const syncedArtwork=${JSON.stringify(coverMap,null,2)};\n\nexport const releaseInfo=${JSON.stringify(releaseInfo,null,2)};\n\nexport const unresolvedArtists=${JSON.stringify(unresolved.map(({id,name})=>({id,name})),null,2)};\n`;
await writeFile(new URL('../js/data/covers.generated.js',import.meta.url),output);
console.log(`Listo · ${Object.keys(coverMap).length} covers · ${unresolved.length} pendientes`);
