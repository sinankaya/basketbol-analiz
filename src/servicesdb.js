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
      players ( id, name, number, position, height, weight, age )
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