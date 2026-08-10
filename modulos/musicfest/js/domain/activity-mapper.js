// MusicFest · traducción entre el objeto `session` del prototipo y los
// documentos de Firestore.
//
// El prototipo guarda el catálogo como mapas dentro de la sesión
// (artistOverrides, artwork, releaseInfo, activeArtistIds, deletedArtistIds).
// Firestore lo guarda como una subcolección con un documento por artista.
// Estas dos funciones son inversas entre sí; las pruebas verifican el viaje de
// ida y vuelta para garantizar que la migración no pierde nada.

/** session (forma heredada) -> Map<artistId, documento de Firestore> */
export function toArtistDocs(session, seedArtists, { keepStoragePath = () => '' } = {}) {
  const deleted = new Set(session.deletedArtistIds || []);
  const active = new Set(session.activeArtistIds || []);
  const overrides = session.artistOverrides || {};
  const artwork = session.artwork || {};
  const info = session.releaseInfo || {};
  const docs = new Map();

  const add = (artist, base, order) => {
    if (deleted.has(artist.id)) return;
    // El panel docente escribe en artistOverrides tanto para artistas base como
    // personalizados; aplicar el override sólo a los base perdía esas ediciones.
    const merged = { ...artist, ...(overrides[artist.id] || {}) };
    const cover = artwork[artist.id] || '';
    const release = info[artist.id] || {};
    docs.set(artist.id, {
      id: artist.id,
      name: merged.name,
      genre: merged.genre,
      country: merged.country,
      cost: Number(merged.cost),
      popularity: Number(merged.popularity),
      duration: Number(merged.duration),
      base,
      order,
      active: active.has(artist.id),
      artworkUrl: cover,
      artworkStoragePath: keepStoragePath(artist.id) || '',
      artworkStatus: cover ? (release.review || 'pending') : 'none',
      album: release.album || '',
      albumYear: release.year || '',
      sourceUrl: release.url || ''
    });
  };

  seedArtists.forEach((artist, index) => add(artist, true, index));
  (session.customArtists || []).forEach((artist, index) => add(artist, false, 1000 + index));
  return docs;
}

/** documentos de Firestore + documento de actividad -> session (forma heredada) */
export function fromArtistDocs(activity, artistDocs, seedIds) {
  const seeds = seedIds instanceof Set ? seedIds : new Set(seedIds || []);
  const customArtists = [];
  const artistOverrides = {};
  const artwork = {};
  const releaseInfo = {};

  const ordered = [...artistDocs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const doc of ordered) {
    const core = {
      id: doc.id, name: doc.name, genre: doc.genre, country: doc.country,
      cost: doc.cost, popularity: doc.popularity, duration: doc.duration
    };
    if (doc.base && seeds.has(doc.id)) artistOverrides[doc.id] = { ...core };
    else customArtists.push({ ...core });
    if (doc.artworkUrl) artwork[doc.id] = doc.artworkUrl;
    if (doc.album || doc.albumYear || doc.sourceUrl || (doc.artworkStatus && doc.artworkStatus !== 'none')) {
      releaseInfo[doc.id] = {
        album: doc.album || '',
        year: doc.albumYear || '',
        url: doc.sourceUrl || '',
        review: doc.artworkStatus || 'pending'
      };
    }
  }

  return {
    code: activity.code,
    name: activity.name,
    mode: activity.mode,
    state: activity.state,
    activeDayIndex: activity.activeDayIndex ?? 0,
    revision: activity.revision ?? 1,
    reopenedFrom: activity.reopenedFrom ?? 0,
    days: activity.days || [],
    artistIds: [],
    activeArtistIds: [...(activity.activeArtistIds || [])],
    deletedArtistIds: [...(activity.deletedArtistIds || [])],
    catalogLocked: Boolean(activity.catalogLocked),
    teamJoinPolicy: activity.teamJoinPolicy || 'open',
    customArtists,
    artistOverrides,
    artwork,
    releaseInfo,
    updatedAt: activity.updatedAt
  };
}

/** Campos que se comparan para decidir si un artista cambió y hay que escribirlo. */
export const ARTIST_FIELDS = ['name', 'genre', 'country', 'cost', 'popularity', 'duration', 'base', 'active', 'artworkUrl', 'artworkStatus', 'album', 'albumYear', 'sourceUrl'];

export const sameArtist = (a, b) => ARTIST_FIELDS.every(field => (a?.[field] ?? '') === (b?.[field] ?? ''));

/** Resumen de integridad de una actividad, usado por el importador y las pruebas. */
export function catalogSummary(session, seedArtists) {
  const docs = toArtistDocs(session, seedArtists);
  const values = [...docs.values()];
  return {
    total: values.length,
    activos: values.filter(a => a.active).length,
    personalizados: values.filter(a => !a.base).length,
    eliminados: (session.deletedArtistIds || []).length,
    conCaratula: values.filter(a => a.artworkUrl).length,
    caratulasAprobadas: values.filter(a => a.artworkStatus === 'approved').length,
    caratulasPorRevisar: values.filter(a => a.artworkUrl && a.artworkStatus !== 'approved').length
  };
}
