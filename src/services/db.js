// src/services/db.js
import { supabase } from '../supabaseClient';

// --- TAKIMLARI VE OYUNCULARI ÇEK ---
export const fetchTeamsWithPlayers = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      category,
      players ( id, name, number, position, height, weight, age, status )
    `);

  if (error) {
    console.error('Takımlar çekilirken hata oluştu:', error);
    throw error;
  }
  return data;
};

// --- YENİ TAKIM EKLE ---
export const addTeamDB = async (name, category = 'A Takım') => {
  const { data, error } = await supabase
    .from('teams')
    .insert([{ name, category }])
    .select();

  if (error) {
    console.error('Takım eklenirken hata oluştu:', error);
    throw error;
  }
  return data[0];
};

// --- YENİ OYUNCU EKLE ---
export const addPlayerDB = async (playerData) => {
  const { data, error } = await supabase
    .from('players')
    .insert([playerData])
    .select();

  if (error) {
    console.error('Oyuncu eklenirken hata oluştu:', error);
    throw error;
  }
  return data[0];
};

// --- OYUNCU DURUMU GÜNCELLE (Aktif / Sakat) ---
export const updatePlayerStatusDB = async (playerId, status) => {
  const { error } = await supabase
    .from('players')
    .update({ status })
    .eq('id', playerId);

  if (error) {
    console.error('Oyuncu durumu güncellenemedi:', error);
    throw error;
  }
};

// --- OYUNCU SİL ---
export const deletePlayerDB = async (playerId) => {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId);

  if (error) {
    console.error('Oyuncu silinemedi:', error);
    throw error;
  }
};

// --- YENİ MAÇ KAYDI OLUŞTUR ---
export const createMatchDB = async (homeTeamId, awayTeamId, matchType) => {
  const { data, error } = await supabase
    .from('matches')
    .insert([{
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      match_type: matchType,
      home_score: 0,
      away_score: 0
    }])
    .select();

  if (error) {
    console.error('Maç oluşturulurken hata oluştu:', error);
    throw error;
  }
  return data[0];
};

// --- MAÇ İSTATİSTİKLERİNİ VE SKORU KAYDET ---
export const saveMatchStatsDB = async (matchId, statsArray, finalHomeScore, finalAwayScore) => {
  if (!matchId) return;

  // 1. Maç skorunu güncelle
  const { error: matchError } = await supabase
    .from('matches')
    .update({ home_score: finalHomeScore, away_score: finalAwayScore })
    .eq('id', matchId);

  if (matchError) console.error('Maç skoru güncellenemedi:', matchError);

  // 2. İstatistikleri kaydet
  const payload = statsArray.map(s => ({
    match_id: matchId,
    player_id: s.id,
    pts: s.pts,
    reb: s.reb,
    ast: s.ast,
    stl: s.stl,
    blk: s.blk,
    tov: s.tov,
    pf: s.pf
  }));

  const { error: statsError } = await supabase
    .from('match_stats')
    .upsert(payload, { onConflict: 'match_id,player_id' });

  if (statsError) {
    console.error('İstatistikler kaydedilirken hata oluştu:', statsError);
    throw statsError;
  }
};

// --- GENEL / SEZONLUK OYUNCU İSTATİSTİKLERİNİ ÇEK ---
export const fetchGeneralPlayerStatsDB = async (teamId, matchType = 'all') => {
  if (!teamId) return [];

  try {
    // 1. Seçili takıma ait tüm oyuncuları getir
    const { data: players, error: playerErr } = await supabase
      .from('players')
      .select('id, name, number, position')
      .eq('team_id', teamId);

    if (playerErr || !players || players.length === 0) return [];

    const playerIds = players.map(p => p.id);

    // 2. Takımın oynadığı maçları filtrele
    let matchQuery = supabase
      .from('matches')
      .select('id, match_type')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

    if (matchType !== 'all') {
      matchQuery = matchQuery.eq('match_type', matchType);
    }

    const { data: matches, error: matchErr } = await matchQuery;

    // Henüz maç yapılmadıysa oyuncuları 0 istatistikle döndür
    if (matchErr || !matches || matches.length === 0) {
      return players.map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position,
        gp: 0,
        pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0
      }));
    }

    const matchIds = matches.map(m => m.id);

    // 3. Bu maçlardaki oyuncu istatistiklerini getir
    const { data: stats, error: statsErr } = await supabase
      .from('match_stats')
      .select('player_id, pts, reb, ast, stl, blk, tov, pf')
      .in('match_id', matchIds)
      .in('player_id', playerIds);

    if (statsErr) {
      console.error('İstatistikler çekilirken hata:', statsErr);
      return players.map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position,
        gp: 0,
        pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0
      }));
    }

    // 4. İstatistikleri birleştirip toplamlarını ve oynanan maç sayısını hesapla
    const aggregated = {};
    players.forEach(p => {
      aggregated[p.id] = {
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position,
        gp: 0,
        pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0
      };
    });

    (stats || []).forEach(s => {
      if (aggregated[s.player_id]) {
        aggregated[s.player_id].gp += 1;
        aggregated[s.player_id].pts += s.pts || 0;
        aggregated[s.player_id].reb += s.reb || 0;
        aggregated[s.player_id].ast += s.ast || 0;
        aggregated[s.player_id].stl += s.stl || 0;
        aggregated[s.player_id].blk += s.blk || 0;
        aggregated[s.player_id].tov += s.tov || 0;
        aggregated[s.player_id].pf += s.pf || 0;
      }
    });

    return Object.values(aggregated);
  } catch (err) {
    console.error('Genel istatistik servisinde beklenmeyen hata:', err);
    return [];
  }
};