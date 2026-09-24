// src/services/db.js
import { supabase } from '../supabaseClient';

// --- KADROSU 5'TEN AZ OLAN VEYA BOŞ TAKIMLARI 15 OYUNCUYA TAMAMLAMA ---
export const generateDefaultPlayersDB = async (teamId, existingPlayers = []) => {
  const currentCount = existingPlayers.length;
  
  // Eğer oyuncu sayısı zaten 5 veya üzerindeyse işlem yapma
  if (currentCount >= 5) return existingPlayers;

  const neededCount = 15 - currentCount; // Kadroyu 15'e tamamlamak için gereken sayı
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  // Mevcut oyuncuların forma numaralarını al (Çakışmayı önlemek için)
  const usedNumbers = new Set(existingPlayers.map(p => p.number.toString().trim()));

  const newPlayers = [];
  let currentNum = 1;

  for (let i = 0; i < neededCount; i++) {
    // Kullanılmayan ilk uygun forma numarasını bul
    while (usedNumbers.has(currentNum.toString())) {
      currentNum++;
    }

    newPlayers.push({
      team_id: teamId,
      name: `Oyuncu ${existingPlayers.length + i + 1}`,
      number: `${currentNum}`,
      position: positions[(existingPlayers.length + i) % 5],
      height: '---',
      weight: '---',
      age: null,
      status: 'active'
    });

    usedNumbers.add(currentNum.toString());
    currentNum++;
  }

  const { data, error } = await supabase
    .from('players')
    .insert(newPlayers)
    .select();

  if (error) {
    console.error('Varsayılan oyuncular eklenirken hata oluştu:', error);
    return existingPlayers;
  }

  return [...existingPlayers, ...data];
};

// --- TAKIMLARI VE OYUNCULARI ÇEK (KONTROL VE EKSİK TAMAMLAMA) ---
export const fetchTeamsWithPlayers = async () => {
  const { data: teams, error } = await supabase
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

  // Oyuncu sayısı 5'ten az olan her takımı otomatik 15'e tamamla
  for (let i = 0; i < teams.length; i++) {
    const currentPlayers = teams[i].players || [];
    if (currentPlayers.length < 5) {
      const updatedPlayers = await generateDefaultPlayersDB(teams[i].id, currentPlayers);
      teams[i].players = updatedPlayers;
    }
  }

  return teams;
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

  const team = data[0];
  const generatedPlayers = await generateDefaultPlayersDB(team.id, []);
  team.players = generatedPlayers;

  return team;
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

// --- OYUNCU DURUMU GÜNCELLE ---
export const updatePlayerStatusDB = async (playerId, status) => {
  const { error } = await supabase
    .from('players')
    .update({ status })
    .eq('id', playerId);

  if (error) throw error;
};

// --- OYUNCU SİL ---
export const deletePlayerDB = async (playerId) => {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId);

  if (error) throw error;
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

  if (error) throw error;
  return data[0];
};

// --- MAÇ İSTATİSTİKLERİNİ KAYDET (AUTO-SAVE UYUMLU) ---
export const saveMatchStatsDB = async (matchId, statsArray, finalHomeScore, finalAwayScore) => {
  if (!matchId || !statsArray || statsArray.length === 0) return;

  try {
    await supabase
      .from('matches')
      .update({ home_score: finalHomeScore, away_score: finalAwayScore })
      .eq('id', matchId);

    const payload = statsArray.map(s => ({
      match_id: matchId,
      player_id: s.id,
      pts: s.pts || 0,
      reb: s.reb || 0,
      ast: s.ast || 0,
      stl: s.stl || 0,
      blk: s.blk || 0,
      tov: s.tov || 0,
      pf: s.pf || 0
    }));

    await supabase
      .from('match_stats')
      .upsert(payload, { onConflict: 'match_id,player_id' });
  } catch (err) {
    console.error('Auto-save sırasında hata:', err);
  }
};

// --- GENEL / SEZONLUK OYUNCU İSTATİSTİKLERİNİ ÇEK ---
export const fetchGeneralPlayerStatsDB = async (teamId, matchType = 'all') => {
  if (!teamId) return [];

  try {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, number, position')
      .eq('team_id', teamId);

    if (!players || players.length === 0) return [];

    const playerIds = players.map(p => p.id);

    let matchQuery = supabase
      .from('matches')
      .select('id, match_type')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

    if (matchType !== 'all') {
      matchQuery = matchQuery.eq('match_type', matchType);
    }

    const { data: matches } = await matchQuery;

    if (!matches || matches.length === 0) {
      return players.map(p => ({
        id: p.id, name: p.name, number: p.number, position: p.position,
        gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0
      }));
    }

    const matchIds = matches.map(m => m.id);

    const { data: stats } = await supabase
      .from('match_stats')
      .select('player_id, pts, reb, ast, stl, blk, tov, pf')
      .in('match_id', matchIds)
      .in('player_id', playerIds);

    const aggregated = {};
    players.forEach(p => {
      aggregated[p.id] = {
        id: p.id, name: p.name, number: p.number, position: p.position,
        gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0
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
    console.error('Genel istatistik servisinde hata:', err);
    return [];
  }
};