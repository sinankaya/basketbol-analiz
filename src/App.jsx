import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Activity, Play, Pause, RotateCcw, 
  Shield, Target, Award, Flame, UserPlus, ShieldPlus,
  BarChart2, ArrowLeftRight, CheckCircle2,
  Settings, RefreshCw, BookOpen, Save,
  UserX, UserCheck, Trash2, Star, AlertCircle, Filter, Undo2, Square, UserCheck2, Hash, MapPin, Power, ChevronDown
} from 'lucide-react';

import { supabase } from './supabaseClient';
import { 
  fetchTeamsWithPlayers, 
  addTeamDB, 
  addPlayerDB, 
  updatePlayerStatusDB, 
  deletePlayerDB, 
  createMatchDB, 
  saveMatchStatsDB,
  fetchGeneralPlayerStatsDB
} from './services/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('live');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // TRACKING MODE STATE ('full' | 'players' | 'scoreboard_only')
  const [trackingMode, setTrackingMode] = useState('scoreboard_only');

  // MATCH STATE
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [homeTeamId, setHomeTeamId] = useState(null);
  const [awayTeamId, setAwayTeamId] = useState(null);
  const [matchType, setMatchType] = useState('Lig Maçı');
  const [activeTrackingTeam, setActiveTrackingTeam] = useState('home');
  const [isMatchStarted, setIsMatchStarted] = useState(false);

  // SELECTION STATES FOR MODES
  const [homeStartingFive, setHomeStartingFive] = useState([]);
  const [awayStartingFive, setAwayStartingFive] = useState([]);
  const [selectedCustomPlayerIds, setSelectedCustomPlayerIds] = useState([]);

  const [matchStats, setMatchStats] = useState({});
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

  // TEAM FOULS STATE (Resets on quarter change)
  const [homeTeamFouls, setHomeTeamFouls] = useState(0);
  const [awayTeamFouls, setAwayTeamFouls] = useState(0);

  // SHOT MAP STATS
  const [shots, setShots] = useState([]);

  const [secondsLeft, setSecondsLeft] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [quarter, setQuarter] = useState(1);
  const [showQuarterMenu, setShowQuarterMenu] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [subOutPlayerId, setSubOutPlayerId] = useState(null);

  // ACTION HISTORY FOR UNDO
  const [actionHistory, setActionHistory] = useState([]);

  // AUTO SAVE TOGGLE & INDICATOR STATE
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // STATS TABS & FILTERS
  const [statsViewMode, setStatsViewMode] = useState('match');
  const [statsTeamFilter, setStatsTeamFilter] = useState('all');
  
  // GENERAL STATS FILTERS
  const [generalSelectedTeamId, setGeneralSelectedTeamId] = useState('');
  const [generalMatchTypeFilter, setGeneralMatchTypeFilter] = useState('all');
  const [generalStatsList, setGeneralStatsList] = useState([]);
  const [generalLoading, setGeneralLoading] = useState(false);

  // ROSTER & FORM STATES
  const [selectedRosterTeamId, setSelectedRosterTeamId] = useState('');
  const [newTeam, setNewTeam] = useState({ name: '', category: 'A Takım' });
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: 'PG', height: '', weight: '', age: '' });
  
  // NOTIFICATION STATES
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const showNotification = (msg, isError = true) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 3500);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  useEffect(() => {
    loadTeamsData();
  }, []);

  useEffect(() => {
    if (statsViewMode === 'general' && generalSelectedTeamId) {
      loadGeneralStats();
    }
  }, [statsViewMode, generalSelectedTeamId, generalMatchTypeFilter]);

  // AUTOMATIC PERIODIC SAVE EFFECT
  useEffect(() => {
    let autoSaveTimer;
    if (isMatchStarted && activeMatchId && isAutoSaveEnabled) {
      autoSaveTimer = setInterval(async () => {
        await saveMatchStatsDB(activeMatchId, Object.values(matchStats), homeScore, awayScore);
        const now = new Date();
        setLastSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
      }, 15000);
    }
    return () => clearInterval(autoSaveTimer);
  }, [isMatchStarted, activeMatchId, isAutoSaveEnabled, matchStats, homeScore, awayScore]);

  const loadTeamsData = async () => {
    try {
      setLoading(true);
      const data = await fetchTeamsWithPlayers();
      if (data && data.length > 0) {
        setTeams(data);
        setHomeTeamId(data[0].id);
        setAwayTeamId(data[1] ? data[1].id : data[0].id);
        setSelectedRosterTeamId(data[0].id.toString());
        setGeneralSelectedTeamId(data[0].id.toString());
      }
    } catch (err) {
      console.error('Veriler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGeneralStats = async () => {
    try {
      setGeneralLoading(true);
      const data = await fetchGeneralPlayerStatsDB(parseInt(generalSelectedTeamId), generalMatchTypeFilter);
      setGeneralStatsList(data || []);
    } catch (err) {
      console.error("Genel istatistikler yüklenemedi:", err);
    } finally {
      setGeneralLoading(false);
    }
  };

  // Timer Effect
  useEffect(() => {
    let timer;
    if (isRunning && secondsLeft > 0) {
      timer = setInterval(() => setSecondsLeft(prev => prev - 1), 1000);
    } else if (secondsLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, secondsLeft]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const calcPIR = (p) => {
    if (!p) return 0;
    return (p.pts + p.reb + p.ast + p.stl + p.blk) - ((p.fga || 0) - (p.fgm || 0) + (p.tov || 0));
  };

  // DEVRE MANTIĞI: 1-2 -> 1. Devre, 3-4 -> 2. Devre, 5+ -> Uzatma (OT)
  const getHalfText = (q) => {
    if (q <= 2) return "1. Devre";
    if (q <= 4) return "2. Devre";
    return "Uzatma";
  };

  // ÇEYREK DEĞİŞTİRME & TAKIM FAULLERİNİ SIFIRLAMA MANTIĞI
  const handleQuarterAdvance = (targetQuarter = null) => {
    const nextQ = targetQuarter !== null ? targetQuarter : (quarter >= 5 ? 1 : quarter + 1);
    setQuarter(nextQ);
    setHomeTeamFouls(0);
    setAwayTeamFouls(0);
    setShowQuarterMenu(false);
    showNotification(`${getHalfText(nextQ)} - ${nextQ > 4 ? 'Uz.' : nextQ + '. Çeyrek'} (Takım faulleri sıfırlandı)`, false);
  };

  const handleTeamTabChange = (teamType) => {
    setActiveTrackingTeam(teamType);
    setSelectedPlayerId(null);
    setSubOutPlayerId(null);
  };

  const toggleHomeStarter = (playerId) => {
    setHomeStartingFive(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 5) {
        showNotification("Ev sahibi için zaten 5 oyuncu seçtiniz!");
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const toggleAwayStarter = (playerId) => {
    setAwayStartingFive(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 5) {
        showNotification("Rakip takım için zaten 5 oyuncu seçtiniz!");
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const toggleCustomPlayer = (playerId) => {
    setSelectedCustomPlayerIds(prev => 
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name) return;
    try {
      const created = await addTeamDB(newTeam.name, newTeam.category);
      await loadTeamsData();
      setSelectedRosterTeamId(created.id.toString());
      setNewTeam({ name: '', category: 'A Takım' });
      showNotification("Yeni takım eklendi!", false);
    } catch (err) {
      showNotification("Takım eklenirken hata oluştu.");
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayer.name || !newPlayer.number || !selectedRosterTeamId) return;

    const targetTeam = teams.find(t => t.id === parseInt(selectedRosterTeamId));
    if (targetTeam && targetTeam.players) {
      const numberExists = targetTeam.players.some(
        p => p.number.toString().trim() === newPlayer.number.toString().trim()
      );

      if (numberExists) {
        showNotification(`HATA: #${newPlayer.number} numaralı oyuncu zaten mevcut!`);
        return;
      }
    }

    try {
      const payload = {
        team_id: parseInt(selectedRosterTeamId),
        name: newPlayer.name,
        number: newPlayer.number.toString().trim(),
        position: newPlayer.position,
        height: newPlayer.height ? `${newPlayer.height} cm` : '---',
        weight: newPlayer.weight ? `${newPlayer.weight} kg` : '---',
        age: newPlayer.age ? parseInt(newPlayer.age) : null,
        status: 'active'
      };

      await addPlayerDB(payload);
      await loadTeamsData();
      setNewPlayer({ name: '', number: '', position: 'PG', height: '', weight: '', age: '' });
      showNotification("Oyuncu eklendi!", false);
    } catch (err) {
      showNotification("Oyuncu eklenirken hata oluştu.");
    }
  };

  const handleToggleStatus = async (player) => {
    const newStatus = player.status === 'injured' ? 'active' : 'injured';
    try {
      await updatePlayerStatusDB(player.id, newStatus);
      await loadTeamsData();
      showNotification(`Oyuncu durumu ${newStatus === 'injured' ? 'Sakat' : 'Aktif'} yapıldı.`, false);
    } catch (err) {
      showNotification("Güncellenemedi.");
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!window.confirm("Bu oyuncuyu silmek istediğinize emin misiniz?")) return;
    try {
      await deletePlayerDB(playerId);
      await loadTeamsData();
      showNotification("Oyuncu silindi.", false);
    } catch (err) {
      showNotification("Silinemedi.");
    }
  };

  const startMatch = async () => {
    if (homeTeamId === awayTeamId) {
      showNotification("Ev sahibi ve rakip takım aynı olamaz!");
      return;
    }

    if (trackingMode === 'full') {
      if (homeStartingFive.length !== 5 || awayStartingFive.length !== 5) {
        showNotification("Her iki takımdan da tam 5 oyuncu seçmelisiniz!");
        return;
      }
    } else if (trackingMode === 'players') {
      if (selectedCustomPlayerIds.length === 0) {
        showNotification("En az 1 oyuncu seçmelisiniz!");
        return;
      }
    }

    const homeTeam = teams.find(t => t.id === homeTeamId);
    const awayTeam = teams.find(t => t.id === awayTeamId);

    try {
      const matchRecord = await createMatchDB(homeTeamId, awayTeamId, matchType);
      setActiveMatchId(matchRecord.id);

      const initialStats = {};

      if (trackingMode === 'full') {
        (homeTeam.players || []).forEach(p => {
          if (p.status === 'injured') return;
          initialStats[p.id] = { ...p, teamType: 'home', isOnCourt: homeStartingFive.includes(p.id), pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, pm3: 0, pa3: 0, ftm: 0, fta: 0 };
        });
        (awayTeam.players || []).forEach(p => {
          if (p.status === 'injured') return;
          initialStats[p.id] = { ...p, teamType: 'away', isOnCourt: awayStartingFive.includes(p.id), pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, pm3: 0, pa3: 0, ftm: 0, fta: 0 };
        });
      } else if (trackingMode === 'players') {
        const allPlayers = [...(homeTeam.players || []), ...(awayTeam.players || [])];
        allPlayers.forEach(p => {
          if (selectedCustomPlayerIds.includes(p.id)) {
            const teamType = (homeTeam.players || []).some(hp => hp.id === p.id) ? 'home' : 'away';
            initialStats[p.id] = { ...p, teamType, isOnCourt: true, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, pm3: 0, pa3: 0, ftm: 0, fta: 0 };
          }
        });
      }

      setMatchStats(initialStats);
      setShots([]);
      setHomeScore(0);
      setAwayScore(0);
      setHomeTeamFouls(0);
      setAwayTeamFouls(0);
      setQuarter(1);
      setActionHistory([]);
      setIsAutoSaveEnabled(true);
      setSelectedPlayerId(null);

      setIsMatchStarted(true);
      setActiveTab('live');
      showNotification("Maç başlatıldı!", false);
    } catch (err) {
      showNotification('Maç başlatılırken hata oluştu.');
    }
  };

  const finishMatch = async () => {
    if (!window.confirm("MAÇI BİTİRMEK İSTEDİĞİNİZE EMİN MİSİNİZ?\n\nTüm veriler veritabanına kaydedilecek ve maç sonlandırılacaktır.")) return;

    try {
      setIsRunning(false);
      if (activeMatchId && trackingMode !== 'scoreboard_only') {
        await saveMatchStatsDB(activeMatchId, Object.values(matchStats), homeScore, awayScore);
      }

      setIsMatchStarted(false);
      setActiveMatchId(null);
      setHomeStartingFive([]);
      setAwayStartingFive([]);
      setSelectedCustomPlayerIds([]);
      setMatchStats({});
      setShots([]);
      setActionHistory([]);
      setSelectedPlayerId(null);
      showNotification("Maç tamamlandı ve veriler kaydedildi! 🏆", false);
    } catch (err) {
      showNotification("Maç sonlandırılırken hata oluştu.");
    }
  };

  const handleDirectScore = (team, pts, isSubtract = false) => {
    if (team === 'home') {
      setHomeScore(s => isSubtract ? Math.max(0, s - pts) : s + pts);
    } else {
      setAwayScore(s => isSubtract ? Math.max(0, s - pts) : s + pts);
    }
  };

  const handleTeamFoulAdd = (team, isSubtract = false) => {
    if (team === 'home') {
      setHomeTeamFouls(f => isSubtract ? Math.max(0, f - 1) : f + 1);
    } else {
      setAwayTeamFouls(f => isSubtract ? Math.max(0, f - 1) : f + 1);
    }
  };

  const homeTeam = teams.find(t => t.id === homeTeamId);
  const awayTeam = teams.find(t => t.id === awayTeamId);
  const selectedRosterTeam = teams.find(t => t.id === parseInt(selectedRosterTeamId));

  const activeStatsList = Object.values(matchStats);
  const currentTrackingPlayers = activeStatsList.filter(p => p.teamType === activeTrackingTeam);
  const courtPlayers = currentTrackingPlayers.filter(p => p.isOnCourt);

  const filteredBoxScore = activeStatsList.filter(p => {
    if (statsTeamFilter === 'home') return p.teamType === 'home';
    if (statsTeamFilter === 'away') return p.teamType === 'away';
    return true;
  });

  const allAvailablePlayers = [
    ...(homeTeam?.players || []).map(p => ({ ...p, teamName: homeTeam?.name, teamType: 'home' })),
    ...(awayTeam?.players || []).map(p => ({ ...p, teamName: awayTeam?.name, teamType: 'away' }))
  ];

  return (
    <div className="flex justify-center bg-gray-950 min-h-screen text-gray-100 font-sans antialiased">
      <div className="w-full max-w-md bg-gray-900 min-h-screen flex flex-col shadow-2xl border-x border-gray-800 relative pb-20 select-none">
        
        {/* NOTIFICATION BANNERS */}
        {errorMsg && (
          <div className="bg-rose-600 text-white p-2.5 text-xs font-bold text-center sticky top-0 z-50 flex items-center justify-center gap-1.5 shadow-lg">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-600 text-white p-2.5 text-xs font-bold text-center sticky top-0 z-50 flex items-center justify-center gap-1.5 shadow-lg">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-2.5 space-y-3">

          {/* TAB 1: LIVE TRACKER */}
          {activeTab === 'live' && (
            <div className="space-y-3">

              {/* EN ÜST MİNİMAL KONTROL BARI (Maç Başlat/Bitir & Süre) */}
              <div className="bg-gray-950 p-2 rounded-2xl border border-gray-800 flex justify-between items-center shadow-lg">
                {!isMatchStarted ? (
                  <button 
                    onClick={startMatch} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition uppercase tracking-wider"
                  >
                    <Play size={14} className="fill-white" /> Maçı Başlat
                  </button>
                ) : (
                  <div className="flex justify-between items-center w-full gap-2">
                    <button 
                      onClick={finishMatch} 
                      className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-1 active:scale-95 transition"
                    >
                      <Power size={12} className="text-rose-400" /> Maçı Bitir
                    </button>

                    <div className="flex items-center gap-1.5 bg-gray-900 px-3 py-1 rounded-xl border border-gray-800">
                      <span className="text-sm font-mono font-black text-emerald-400">{formatTime(secondsLeft)}</span>
                      <button 
                        onClick={() => setIsRunning(!isRunning)} 
                        className="p-1 text-gray-300 hover:text-white transition active:scale-90"
                      >
                        {isRunning ? <Pause size={14} className="text-amber-400 fill-amber-400" /> : <Play size={14} className="text-emerald-400 fill-emerald-400" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {!isMatchStarted ? (
                <div className="bg-gray-800/80 p-3.5 rounded-xl border border-gray-700 space-y-3">
                  <div className="text-center">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block">Yeni Maç Kurulumu</span>
                    <p className="text-[10px] text-gray-400">İstatistik tutma modunu seçip yukarıdaki butonla maçı başlatın</p>
                  </div>

                  {/* MOD SEÇİM BUTONLARI */}
                  <div className="grid grid-cols-3 gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-700">
                    <button 
                      onClick={() => setTrackingMode('full')}
                      className={`py-2 px-1 rounded-lg text-[10px] font-black transition flex flex-col items-center gap-1 ${
                        trackingMode === 'full' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Users size={14} /> Tam Maç (5'e 5)
                    </button>
                    <button 
                      onClick={() => setTrackingMode('players')}
                      className={`py-2 px-1 rounded-lg text-[10px] font-black transition flex flex-col items-center gap-1 ${
                        trackingMode === 'players' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Target size={14} /> Belirli Oyuncular
                    </button>
                    <button 
                      onClick={() => setTrackingMode('scoreboard_only')}
                      className={`py-2 px-1 rounded-lg text-[10px] font-black transition flex flex-col items-center gap-1 ${
                        trackingMode === 'scoreboard_only' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Hash size={14} /> Sadece Skor
                    </button>
                  </div>

                  {/* TAKIM SEÇİMLERİ */}
                  <div className="space-y-2 text-left pt-1">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold block mb-1">Maç Türü</label>
                      <select value={matchType} onChange={e => setMatchType(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold">
                        <option value="Lig Maçı">Lig Maçı</option>
                        <option value="Hazırlık Maçı">Hazırlık Maçı</option>
                        <option value="Turnuva">Turnuva</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 font-bold block mb-1">Ev Sahibi Takım</label>
                        <select value={homeTeamId || ''} onChange={e => { setHomeTeamId(parseInt(e.target.value)); setHomeStartingFive([]); }} className="w-full bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold">
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-bold block mb-1">Rakip Takım</label>
                        <select value={awayTeamId || ''} onChange={e => { setAwayTeamId(parseInt(e.target.value)); setAwayStartingFive([]); }} className="w-full bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold">
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* YENİ SADE HIZLI SKORBOARD TASARIMI */
                <div className="space-y-3">
                  
                  {/* SKOR VE ÇEYREK MODÜLÜ */}
                  <div className="bg-gray-900 p-3 rounded-2xl border border-gray-800 shadow-2xl space-y-3">
                    
                    <div className="grid grid-cols-7 gap-2 items-center">
                      
                      {/* SOL: EV SAHİBİ SKOR BUTONU (+1 EKLEME) */}
                      <div className="col-span-3 flex flex-col items-center relative">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider mb-1 truncate w-full text-center">
                          {homeTeam?.name || 'EV SAHİBİ'}
                        </span>
                        
                        <button
                          onClick={() => handleDirectScore('home', 1)}
                          className="w-full h-28 bg-gradient-to-b from-orange-600 to-orange-800 hover:from-orange-500 hover:to-orange-700 text-white rounded-2xl border-2 border-orange-400/50 shadow-xl flex flex-col justify-center items-center active:scale-95 transition relative overflow-hidden"
                        >
                          <span className="text-4xl font-mono font-black">{homeScore}</span>
                          <span className="text-[9px] font-extrabold text-orange-200 uppercase tracking-widest mt-1">+1 SKOR</span>
                        </button>

                        {/* MİNİMAL EKSİLTME DÜĞMESİ */}
                        <button 
                          onClick={() => handleDirectScore('home', 1, true)} 
                          title="-1 Düş"
                          className="absolute -top-1 -left-1 bg-gray-950 hover:bg-rose-950 border border-rose-800/80 text-rose-400 font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center shadow"
                        >
                          -1
                        </button>
                      </div>

                      {/* ORTA: AKILLI ÇEYREK & DEVRE BUTONU */}
                      <div className="col-span-1 flex flex-col items-center justify-center relative">
                        <button
                          onClick={() => handleQuarterAdvance()}
                          className="w-full py-3 bg-gray-950 hover:bg-gray-800 border border-gray-700/80 rounded-xl flex flex-col items-center justify-center shadow transition active:scale-90"
                        >
                          <span className="text-[8px] font-black text-orange-400 uppercase tracking-tighter">
                            {getHalfText(quarter)}
                          </span>
                          <span className="text-sm font-black text-white font-mono my-0.5">
                            {quarter > 4 ? 'UZ' : `${quarter}.Ç`}
                          </span>
                          <ChevronDown size={10} className="text-gray-400" />
                        </button>

                        {/* MANUEL ÇEYREK SEÇİMİ AÇILIR MENÜSÜ */}
                        <button
                          onClick={() => setShowQuarterMenu(!showQuarterMenu)}
                          className="text-[8px] text-gray-500 underline font-bold mt-1"
                        >
                          Değiştir
                        </button>

                        {showQuarterMenu && (
                          <div className="absolute top-14 z-50 bg-gray-950 border border-gray-700 rounded-xl p-1 shadow-2xl flex flex-col gap-1 w-20 text-[9px] font-bold">
                            {[1, 2, 3, 4, 5].map(q => (
                              <button
                                key={q}
                                onClick={() => handleQuarterAdvance(q)}
                                className={`p-1 rounded text-center ${quarter === q ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                              >
                                {q > 4 ? 'Uzatma' : `${q}. Çeyrek`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* SAĞ: RAKİP SKOR BUTONU (+1 EKLEME) */}
                      <div className="col-span-3 flex flex-col items-center relative">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1 truncate w-full text-center">
                          {awayTeam?.name || 'RAKİP'}
                        </span>

                        <button
                          onClick={() => handleDirectScore('away', 1)}
                          className="w-full h-28 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl border-2 border-blue-400/50 shadow-xl flex flex-col justify-center items-center active:scale-95 transition relative overflow-hidden"
                        >
                          <span className="text-4xl font-mono font-black">{awayScore}</span>
                          <span className="text-[9px] font-extrabold text-blue-200 uppercase tracking-widest mt-1">+1 SKOR</span>
                        </button>

                        {/* MİNİMAL EKSİLTME DÜĞMESİ */}
                        <button 
                          onClick={() => handleDirectScore('away', 1, true)} 
                          title="-1 Düş"
                          className="absolute -top-1 -right-1 bg-gray-950 hover:bg-rose-950 border border-rose-800/80 text-rose-400 font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center shadow"
                        >
                          -1
                        </button>
                      </div>

                    </div>

                    {/* TAKIM FAULLERİ PANENLİ (Çeyrek Değişince Otomatik Sıfırlanır) */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                      {/* Ev Sahibi Faul */}
                      <div className="flex justify-between items-center bg-gray-950 p-2 rounded-xl border border-gray-800">
                        <span className="text-[10px] font-bold text-gray-400">Takım Faulü</span>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleTeamFoulAdd('home')}
                            className={`px-2.5 py-1 rounded-lg font-black text-xs border transition active:scale-95 ${
                              homeTeamFouls >= 4 ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-gray-800 text-orange-400 border-gray-700'
                            }`}
                          >
                            {homeTeamFouls} {homeTeamFouls >= 4 && '(BONUS)'}
                          </button>
                          <button 
                            onClick={() => handleTeamFoulAdd('home', true)}
                            className="text-[9px] text-gray-500 hover:text-rose-400 font-bold px-1"
                          >
                            -
                          </button>
                        </div>
                      </div>

                      {/* Rakip Faul */}
                      <div className="flex justify-between items-center bg-gray-950 p-2 rounded-xl border border-gray-800">
                        <span className="text-[10px] font-bold text-gray-400">Takım Faulü</span>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleTeamFoulAdd('away')}
                            className={`px-2.5 py-1 rounded-lg font-black text-xs border transition active:scale-95 ${
                              awayTeamFouls >= 4 ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-gray-800 text-blue-400 border-gray-700'
                            }`}
                          >
                            {awayTeamFouls} {awayTeamFouls >= 4 && '(BONUS)'}
                          </button>
                          <button 
                            onClick={() => handleTeamFoulAdd('away', true)}
                            className="text-[9px] text-gray-500 hover:text-rose-400 font-bold px-1"
                          >
                            -
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 2: ROSTER & TEAM MANAGEMENT */}
          {activeTab === 'roster' && (
            <div className="space-y-3">
              <div className="text-center py-1 border-b border-gray-800">
                <h3 className="text-sm font-black text-orange-500 uppercase tracking-wider">Kadro & Takım Yönetimi</h3>
              </div>

              <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-800 space-y-2">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1"><ShieldPlus size={14} /> Yeni Takım Ekle</span>
                <form onSubmit={handleAddTeam} className="flex gap-2">
                  <input type="text" placeholder="Takım Adı" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="flex-1 bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded-lg" required />
                  <button type="submit" className="bg-orange-600 text-white font-bold px-3 py-2 rounded-lg text-xs">Ekle</button>
                </form>
              </div>

              <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Yönetilecek Takım</label>
                <select value={selectedRosterTeamId} onChange={e => setSelectedRosterTeamId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold">
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {selectedRosterTeam && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1"><Users size={14} className="text-orange-400" /> Kadro ({selectedRosterTeam.players?.length || 0} Oyuncu)</span>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {(selectedRosterTeam.players || []).map(p => (
                      <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${p.status === 'injured' ? 'bg-rose-950/20 border-rose-900/50 opacity-60' : 'bg-gray-800/60 border-gray-700/60'}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-orange-400 w-5">#{p.number}</span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1">
                              {p.name}
                              {p.status === 'injured' && <span className="text-[8px] bg-rose-900 text-rose-300 font-bold px-1 rounded">SAKAT</span>}
                            </div>
                            <div className="text-[8px] text-gray-400">{p.position}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleToggleStatus(p)} className="p-1.5 text-rose-400 hover:text-rose-300">
                            {p.status === 'injured' ? <UserCheck size={14} /> : <UserX size={14} />}
                          </button>
                          <button onClick={() => handleDeletePlayer(p.id)} className="p-1.5 text-gray-500 hover:text-rose-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/80 space-y-2">
                <span className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1"><UserPlus size={14} className="text-orange-400" /> Oyuncu Ekle</span>
                <form onSubmit={handleAddPlayer} className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="Ad Soyad" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded col-span-2" required />
                    <input type="number" placeholder="Forma #" value={newPlayer.number} onChange={e => setNewPlayer({...newPlayer, number: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded" required />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs">Oyuncuyu Kaydet</button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-3">
              <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                <button onClick={() => setStatsViewMode('match')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${statsViewMode === 'match' ? 'bg-orange-600 text-white' : 'text-gray-400'}`}>Maç İstatistiği</button>
                <button onClick={() => setStatsViewMode('general')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${statsViewMode === 'general' ? 'bg-orange-600 text-white' : 'text-gray-400'}`}>Genel İstatistikler</button>
              </div>

              <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-gray-800/90 text-gray-400 uppercase text-[9px] border-b border-gray-800">
                    <tr>
                      <th className="p-2">Oyuncu</th>
                      <th className="p-1 text-center font-black text-amber-400">PIR</th>
                      <th className="p-1 text-center">PTS</th>
                      <th className="p-1 text-center">REB</th>
                      <th className="p-1 text-center">AST</th>
                      <th className="p-1 text-center">TOV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredBoxScore.map(p => (
                      <tr key={p.id}>
                        <td className="p-2 font-medium">#{p.number} {p.name}</td>
                        <td className="p-1 text-center font-bold text-amber-400">{calcPIR(p)}</td>
                        <td className="p-1 text-center font-bold text-orange-400">{p.pts}</td>
                        <td className="p-1 text-center">{p.reb}</td>
                        <td className="p-1 text-center">{p.ast}</td>
                        <td className="p-1 text-center text-rose-400">{p.tov}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: GLOSSARY */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1"><BookOpen size={14} /> Terimler</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                  <div className="bg-gray-800/50 p-1.5 rounded"><strong className="text-orange-400">PTS:</strong> Toplam sayı</div>
                  <div className="bg-gray-800/50 p-1.5 rounded"><strong className="text-blue-400">REB:</strong> Ribaund</div>
                  <div className="bg-gray-800/50 p-1.5 rounded"><strong className="text-amber-400">AST:</strong> Asist</div>
                  <div className="bg-gray-800/50 p-1.5 rounded"><strong className="text-amber-300">PIR:</strong> Performans verimliliği</div>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* BOTTOM NAV */}
        <nav className="absolute bottom-0 inset-x-0 bg-gray-950/95 border-t border-gray-800 flex justify-around p-2 z-30">
          <button onClick={() => setActiveTab('live')} className={`flex flex-col items-center text-[9px] font-bold ${activeTab === 'live' ? 'text-orange-500' : 'text-gray-500'}`}><Activity size={16} /> Canlı Maç</button>
          <button onClick={() => setActiveTab('roster')} className={`flex flex-col items-center text-[9px] font-bold ${activeTab === 'roster' ? 'text-orange-500' : 'text-gray-500'}`}><Users size={16} /> Kadro</button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center text-[9px] font-bold ${activeTab === 'stats' ? 'text-orange-500' : 'text-gray-500'}`}><BarChart2 size={16} /> İstatistik</button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center text-[9px] font-bold ${activeTab === 'settings' ? 'text-orange-500' : 'text-gray-500'}`}><Settings size={16} /> Sözlük</button>
        </nav>

      </div>
    </div>
  );
}