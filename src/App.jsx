import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Activity, Play, Pause, RotateCcw, 
  Shield, Target, Award, Flame, UserPlus, ShieldPlus,
  BarChart2, ArrowLeftRight, CheckCircle2,
  Settings, RefreshCw, BookOpen, Save,
  UserX, UserCheck, Trash2, Star, AlertCircle, Filter, Undo2, Square, UserCheck2, Hash
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
  const [trackingMode, setTrackingMode] = useState('full');

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

  const [secondsLeft, setSecondsLeft] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [quarter, setQuarter] = useState(1);

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
      setHomeScore(0);
      setAwayScore(0);
      setActionHistory([]);
      setIsAutoSaveEnabled(true);
      
      const firstPlayerKey = Object.keys(initialStats)[0];
      setSelectedPlayerId(firstPlayerKey ? parseInt(firstPlayerKey) : null);

      setIsMatchStarted(true);
      setActiveTab('live');
      showNotification("Maç başlatıldı!", false);
    } catch (err) {
      showNotification('Maç başlatılırken hata oluştu.');
    }
  };

  const finishMatch = async () => {
    if (!window.confirm("Maçı bitirmek ve kaydedip sonlandırmak istiyor musunuz?")) return;

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
      setActionHistory([]);
      showNotification("Maç tamamlandı ve veriler kaydedildi! 🏆", false);
    } catch (err) {
      showNotification("Maç sonlandırılırken hata oluştu.");
    }
  };

  const handleStat = (type, ptsValue = 0, isMake = true, isSubtract = false) => {
    if (!selectedPlayerId || !matchStats[selectedPlayerId]) return;

    const player = matchStats[selectedPlayerId];

    if (!isSubtract) {
      setActionHistory(prev => [
        ...prev,
        { playerId: selectedPlayerId, type, ptsValue, isMake, teamType: player.teamType, timestamp: Date.now() }
      ]);
    }

    setMatchStats(prev => {
      const updatedPlayer = { ...prev[selectedPlayerId] };

      if (type === 'PTS') {
        if (isSubtract) {
          updatedPlayer.pts = Math.max(0, updatedPlayer.pts - ptsValue);
          if (ptsValue === 3) { updatedPlayer.pm3 = Math.max(0, updatedPlayer.pm3 - (isMake ? 1 : 0)); updatedPlayer.pa3 = Math.max(0, updatedPlayer.pa3 - 1); }
          else if (ptsValue === 2) { updatedPlayer.fgm = Math.max(0, updatedPlayer.fgm - (isMake ? 1 : 0)); updatedPlayer.fga = Math.max(0, updatedPlayer.fga - 1); }
          else if (ptsValue === 1) { updatedPlayer.ftm = Math.max(0, updatedPlayer.ftm - (isMake ? 1 : 0)); updatedPlayer.fta = Math.max(0, updatedPlayer.fta - 1); }
        } else {
          updatedPlayer.pts += ptsValue;
          if (ptsValue === 3) { updatedPlayer.pm3 += isMake ? 1 : 0; updatedPlayer.pa3 += 1; }
          else if (ptsValue === 2) { updatedPlayer.fgm += isMake ? 1 : 0; updatedPlayer.fga += 1; }
          else if (ptsValue === 1) { updatedPlayer.ftm += isMake ? 1 : 0; updatedPlayer.fta += 1; }
        }
      } else if (type === 'REB') updatedPlayer.reb = isSubtract ? Math.max(0, updatedPlayer.reb - 1) : updatedPlayer.reb + 1;
      else if (type === 'AST') updatedPlayer.ast = isSubtract ? Math.max(0, updatedPlayer.ast - 1) : updatedPlayer.ast + 1;
      else if (type === 'STL') updatedPlayer.stl = isSubtract ? Math.max(0, updatedPlayer.stl - 1) : updatedPlayer.stl + 1;
      else if (type === 'BLK') updatedPlayer.blk = isSubtract ? Math.max(0, updatedPlayer.blk - 1) : updatedPlayer.blk + 1;
      else if (type === 'TOV') updatedPlayer.tov = isSubtract ? Math.max(0, updatedPlayer.tov - 1) : updatedPlayer.tov + 1;
      else if (type === 'PF') updatedPlayer.pf = isSubtract ? Math.max(0, updatedPlayer.pf - 1) : updatedPlayer.pf + 1;

      return { ...prev, [selectedPlayerId]: updatedPlayer };
    });

    if (type === 'PTS' && isMake) {
      if (player.teamType === 'home') {
        setHomeScore(s => isSubtract ? Math.max(0, s - ptsValue) : s + ptsValue);
      } else {
        setAwayScore(s => isSubtract ? Math.max(0, s - ptsValue) : s + ptsValue);
      }
    }

    if (isSubtract) showNotification("İstatistik düşürüldü (-)", false);
  };

  const handleDirectScore = (team, pts, isSubtract = false) => {
    if (team === 'home') {
      setHomeScore(s => isSubtract ? Math.max(0, s - pts) : s + pts);
    } else {
      setAwayScore(s => isSubtract ? Math.max(0, s - pts) : s + pts);
    }
  };

  const handleUndo = () => {
    if (actionHistory.length === 0) {
      showNotification("Geri alınacak bir işlem bulunamadı!");
      return;
    }

    const lastAction = actionHistory[actionHistory.length - 1];
    handleStat(lastAction.type, lastAction.ptsValue, lastAction.isMake, true);
    setActionHistory(prev => prev.slice(0, -1));
    showNotification("Son işlem geri alındı ✓", false);
  };

  const executeSub = (benchPlayerId) => {
    if (!subOutPlayerId) return;

    setMatchStats(prev => ({
      ...prev,
      [subOutPlayerId]: { ...prev[subOutPlayerId], isOnCourt: false },
      [benchPlayerId]: { ...prev[benchPlayerId], isOnCourt: true },
    }));

    setSelectedPlayerId(benchPlayerId);
    setSubOutPlayerId(null);
  };

  const homeTeam = teams.find(t => t.id === homeTeamId);
  const awayTeam = teams.find(t => t.id === awayTeamId);
  const selectedRosterTeam = teams.find(t => t.id === parseInt(selectedRosterTeamId));

  const activeStatsList = Object.values(matchStats);
  const currentTrackingPlayers = activeStatsList.filter(p => p.teamType === activeTrackingTeam);
  const courtPlayers = currentTrackingPlayers.filter(p => p.isOnCourt);
  const benchPlayers = currentTrackingPlayers.filter(p => !p.isOnCourt);
  const selectedPlayer = matchStats[selectedPlayerId];

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

        {/* HEADER / SCOREBOARD */}
        <header className="bg-gradient-to-b from-gray-800 to-gray-900 px-3 py-2 border-b border-gray-800 sticky top-0 z-30 shadow-md">
          <div className="flex justify-between items-center bg-gray-950/90 px-3 py-2 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-black text-gray-200 truncate max-w-[80px]">{homeTeam?.name || 'Ev Sahibi'}</span>
              <span className="text-2xl font-black text-orange-500">{homeScore}</span>
            </div>

            <div className="flex flex-col items-center px-3 border-x border-gray-800">
              <span className="text-[9px] font-extrabold text-orange-400 uppercase tracking-widest">{matchType}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-black text-gray-400">{quarter}P</span>
                <span className="text-sm font-mono font-black text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">{formatTime(secondsLeft)}</span>
                <button onClick={() => setIsRunning(!isRunning)} className="p-1 text-gray-300 hover:text-white transition active:scale-95">
                  {isRunning ? <Pause size={14} className="text-amber-400 fill-amber-400" /> : <Play size={14} className="text-emerald-400 fill-emerald-400" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 flex-1">
              <span className="text-2xl font-black text-gray-200">{awayScore}</span>
              <span className="text-xs font-black text-gray-400 truncate max-w-[80px]">{awayTeam?.name || 'Rakip'}</span>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-2.5 space-y-3">

          {/* TAB 1: LIVE TRACKER */}
          {activeTab === 'live' && (
            <div className="space-y-3">
              {!isMatchStarted ? (
                <div className="bg-gray-800/80 p-3.5 rounded-xl border border-gray-700 space-y-3">
                  <div className="text-center">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block">Yeni Maç Kurulumu</span>
                    <p className="text-[10px] text-gray-400">İstatistik tutma modunu seçip maçı başlatın</p>
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

                  {/* MOD 1: TAM MAÇ (İLK 5 SEÇİMİ) */}
                  {trackingMode === 'full' && (
                    <div className="space-y-2 pt-2 border-t border-gray-700/80">
                      <div className="bg-gray-900/90 p-2.5 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] font-bold text-orange-400">{homeTeam?.name} - İlk 5</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${homeStartingFive.length === 5 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                            {homeStartingFive.length}/5 Seçildi
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                          {(homeTeam?.players || []).map(p => (
                            <button key={p.id} disabled={p.status === 'injured'} onClick={() => toggleHomeStarter(p.id)} className={`p-1.5 rounded text-left border text-[10px] font-bold transition flex justify-between items-center ${homeStartingFive.includes(p.id) ? 'bg-orange-600/30 border-orange-500 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-300'}`}>
                              <span className="truncate">#{p.number} {p.name}</span>
                              <Star size={12} className={homeStartingFive.includes(p.id) ? 'text-orange-400 fill-orange-400' : 'text-gray-600'} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-900/90 p-2.5 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] font-bold text-blue-400">{awayTeam?.name} - İlk 5</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${awayStartingFive.length === 5 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                            {awayStartingFive.length}/5 Seçildi
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                          {(awayTeam?.players || []).map(p => (
                            <button key={p.id} disabled={p.status === 'injured'} onClick={() => toggleAwayStarter(p.id)} className={`p-1.5 rounded text-left border text-[10px] font-bold transition flex justify-between items-center ${awayStartingFive.includes(p.id) ? 'bg-blue-600/30 border-blue-500 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-300'}`}>
                              <span className="truncate">#{p.number} {p.name}</span>
                              <Star size={12} className={awayStartingFive.includes(p.id) ? 'text-blue-400 fill-blue-400' : 'text-gray-600'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MOD 2: BELİRLİ OYUNCULAR (ÖZEL SEÇİM) */}
                  {trackingMode === 'players' && (
                    <div className="bg-gray-900/90 p-2.5 rounded-lg border border-gray-700 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-orange-400">Takip Edilecek Oyuncuları Seçin</span>
                        <span className="text-[10px] font-black bg-orange-950 text-orange-400 px-2 py-0.5 rounded border border-orange-800">
                          {selectedCustomPlayerIds.length} Oyuncu Seçildi
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                        {allAvailablePlayers.map(p => {
                          const isSelected = selectedCustomPlayerIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => toggleCustomPlayer(p.id)}
                              className={`p-2 rounded-lg border text-left text-[10px] font-bold transition flex justify-between items-center ${
                                isSelected ? 'bg-emerald-600/30 border-emerald-500 text-white shadow' : 'bg-gray-800/60 border-gray-700 text-gray-300'
                              }`}
                            >
                              <div>
                                <div className="truncate">#{p.number} {p.name}</div>
                                <div className="text-[8px] text-gray-400">{p.teamName}</div>
                              </div>
                              <UserCheck2 size={14} className={isSelected ? 'text-emerald-400' : 'text-gray-600'} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* MOD 3: SADECE SKOR */}
                  {trackingMode === 'scoreboard_only' && (
                    <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 text-center space-y-1">
                      <span className="text-xs font-bold text-emerald-400 block">Sadece Skor Takip Modu</span>
                      <p className="text-[10px] text-gray-400">Oyuncu istatistiği tutulmayacak. Doğrudan skorboard düğmeleriyle maç skoru takip edilecek.</p>
                    </div>
                  )}

                  <button 
                    onClick={startMatch} 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition"
                  >
                    <CheckCircle2 size={16} /> Maçı Başlat
                  </button>
                </div>
              ) : (
                <>
                  {/* OTO-KAYIT TOGGLE */}
                  <div className="flex justify-between items-center bg-gray-950 p-1 rounded-xl border border-gray-800 gap-1.5">
                    {trackingMode !== 'scoreboard_only' && (
                      <div className="flex flex-1 gap-1">
                        <button onClick={() => setActiveTrackingTeam('home')} className={`flex-1 py-1.5 rounded-lg text-xs font-black transition ${activeTrackingTeam === 'home' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>{homeTeam?.name}</button>
                        <button onClick={() => setActiveTrackingTeam('away')} className={`flex-1 py-1.5 rounded-lg text-xs font-black transition ${activeTrackingTeam === 'away' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>{awayTeam?.name}</button>
                      </div>
                    )}

                    <button 
                      onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition ${isAutoSaveEnabled ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-400' : 'bg-amber-950/80 border-amber-800/60 text-amber-400'}`}
                    >
                      <Save size={12} className={isAutoSaveEnabled ? 'animate-pulse' : ''} />
                      <span>{isAutoSaveEnabled ? (lastSavedTime ? `Oto Kayıt: ${lastSavedTime}` : 'Oto Kayıt: Aktif') : 'Oto Kayıt: Durduruldu'}</span>
                    </button>
                  </div>

                  {/* CANLI EKRAN - SADECE SKOR MODU */}
                  {trackingMode === 'scoreboard_only' ? (
                    <div className="bg-gray-900 rounded-2xl p-4 border-2 border-orange-500/30 shadow-2xl space-y-4">
                      <div className="text-center border-b border-gray-800 pb-2">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-widest">Hızlı Skorboard Modu</span>
                      </div>

                      {/* EV SAHİBİ SKOR DÜĞMELERİ */}
                      <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-orange-400">{homeTeam?.name}</span>
                          <span className="text-2xl font-black text-white">{homeScore} SAYI</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => handleDirectScore('home', 1)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs">+1 Sayı</button>
                          <button onClick={() => handleDirectScore('home', 2)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs">+2 Sayı</button>
                          <button onClick={() => handleDirectScore('home', 3)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs">+3 Sayı</button>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => handleDirectScore('home', 1, true)} className="text-[10px] font-bold text-rose-400 hover:underline">-1 Skor Düş</button>
                        </div>
                      </div>

                      {/* RAKİP SKOR DÜĞMELERİ */}
                      <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-blue-400">{awayTeam?.name}</span>
                          <span className="text-2xl font-black text-white">{awayScore} SAYI</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => handleDirectScore('away', 1)} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-xs">+1 Sayı</button>
                          <button onClick={() => handleDirectScore('away', 2)} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-xs">+2 Sayı</button>
                          <button onClick={() => handleDirectScore('away', 3)} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-xs">+3 Sayı</button>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => handleDirectScore('away', 1, true)} className="text-[10px] font-bold text-rose-400 hover:underline">-1 Skor Düş</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* CANLI EKRAN - OYUNCU VEYA TAM MAÇ MODU */
                    <>
                      {/* SAHADAKİ OYUNCULAR */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5 px-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <Users size={12} className="text-orange-400" /> Takip Edilen Oyuncular
                          </span>
                          {trackingMode === 'full' && <span className="text-[9px] text-orange-400 font-bold">🔄 Değişiklik</span>}
                        </div>
                        
                        <div className="grid grid-cols-5 gap-1.5">
                          {courtPlayers.map(player => {
                            const isSelected = player.id === selectedPlayerId;
                            const isMarkedForSub = player.id === subOutPlayerId;

                            return (
                              <div key={player.id} className="relative">
                                <button
                                  onClick={() => { setSelectedPlayerId(player.id); if (subOutPlayerId === player.id) setSubOutPlayerId(null); }}
                                  className={`w-full p-1 rounded-xl border text-left transition-all flex flex-col justify-between h-20 relative overflow-hidden active:scale-95 ${
                                    isMarkedForSub ? 'bg-rose-900/50 border-rose-500 text-rose-200 animate-pulse' :
                                    isSelected ? 'bg-gradient-to-b from-orange-600/30 to-orange-950/60 border-2 border-orange-500 text-white shadow-xl scale-[1.02]' : 'bg-gray-800/80 border-gray-700/80 text-gray-300'
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <span className={`text-[11px] font-black px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-orange-500 text-black' : 'bg-gray-700 text-gray-200'}`}>#{player.number}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">{player.position}</span>
                                  </div>
                                  <div className="text-[11px] font-black leading-tight truncate my-0.5 text-white">{player.name.split(' ')[0]}</div>
                                  <div className="flex justify-between items-center pt-1 border-t border-gray-700/60 text-[9px] font-bold">
                                    <span className="text-orange-400">{player.pts}S</span>
                                    <span className={`${player.pf >= 4 ? 'text-red-400 font-extrabold' : 'text-gray-400'}`}>{player.pf}F</span>
                                  </div>
                                </button>

                                {trackingMode === 'full' && (
                                  <button onClick={() => setSubOutPlayerId(isMarkedForSub ? null : player.id)} title="Oyuncu Değiştir" className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border shadow-lg transition ${isMarkedForSub ? 'bg-rose-600 border-rose-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300'}`}>
                                    <RefreshCw size={11} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* BENCH DEĞİŞİKLİK ÇEKMECESİ */}
                      {subOutPlayerId && trackingMode === 'full' && (
                        <div className="bg-rose-950/40 border-2 border-rose-800 rounded-2xl p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-rose-300 flex items-center gap-1"><ArrowLeftRight size={14} /> Girecek Oyuncuyu Seçin:</span>
                            <button onClick={() => setSubOutPlayerId(null)} className="text-[10px] text-gray-400 hover:text-white underline font-bold">İptal</button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {benchPlayers.map(bPlayer => (
                              <button key={bPlayer.id} onClick={() => executeSub(bPlayer.id)} className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600 p-2 rounded-xl text-left transition flex items-center justify-between shadow-md">
                                <div>
                                  <div className="text-xs font-black text-emerald-300">#{bPlayer.number} {bPlayer.name.split(' ')[0]}</div>
                                  <div className="text-[9px] font-bold text-gray-400">{bPlayer.position} | {bPlayer.pts} PTS</div>
                                </div>
                                <span className="text-[10px] font-black bg-emerald-600 text-black px-1.5 py-0.5 rounded-lg">GİR ➔</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* İSTATİSTİK BUTONLARI PANENLİ */}
                      {selectedPlayer && (
                        <div className="bg-gray-900 rounded-2xl p-3 border-2 border-orange-500/30 shadow-2xl space-y-2.5">
                          <div className="flex justify-between items-center pb-1.5 border-b border-gray-800">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-orange-500 text-black font-black text-xs px-2 py-0.5 rounded-md">#{selectedPlayer.number}</span>
                              <span className="text-xs font-black text-white truncate max-w-[110px]">{selectedPlayer.name}</span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-orange-400">{selectedPlayer.pts} Sayı | {selectedPlayer.reb} Reb | {selectedPlayer.ast} Ast</span>
                          </div>

                          <button onClick={handleUndo} disabled={actionHistory.length === 0} className={`w-full font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition ${actionHistory.length > 0 ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80' : 'bg-gray-800/40 text-gray-600 border border-gray-800 cursor-not-allowed'}`}>
                            <Undo2 size={14} /> {actionHistory.length > 0 ? `Son İşlemi Geri Al (${actionHistory.length} İşlem)` : 'Geri Alınacak İşlem Yok'}
                          </button>

                          {/* BÜYÜK + VE MİNİK - BUTONLARI */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('PTS', 2, true, false)} className="flex-1 bg-gradient-to-b from-emerald-600 to-emerald-800 text-white font-black py-3 rounded-xl text-xs border border-emerald-400/30">+2 Sayı</button>
                              <button onClick={() => handleStat('PTS', 2, true, true)} className="bg-rose-950/80 border border-rose-700 text-rose-300 font-black text-base px-3 py-2.5 rounded-xl">-</button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('PTS', 3, true, false)} className="flex-1 bg-gradient-to-b from-emerald-600 to-emerald-800 text-white font-black py-3 rounded-xl text-xs border border-emerald-400/30">+3 Sayı</button>
                              <button onClick={() => handleStat('PTS', 3, true, true)} className="bg-rose-950/80 border border-rose-700 text-rose-300 font-black text-base px-3 py-2.5 rounded-xl">-</button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('PTS', 1, true, false)} className="flex-1 bg-gradient-to-b from-emerald-700 to-emerald-900 text-emerald-100 font-bold py-3 rounded-xl text-[10px] border border-emerald-500/20">+1 Serbest</button>
                              <button onClick={() => handleStat('PTS', 1, true, true)} className="bg-rose-950/80 border border-rose-700 text-rose-300 font-black text-base px-3 py-2.5 rounded-xl">-</button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('REB', 0, true, false)} className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Shield size={13} className="text-blue-400" /> REB</button>
                              <button onClick={() => handleStat('REB', 0, true, true)} className="bg-gray-900 border border-gray-700 text-rose-400 font-black text-xs px-2.5 py-2 rounded-xl">-</button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('AST', 0, true, false)} className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Target size={13} className="text-amber-400" /> AST</button>
                              <button onClick={() => handleStat('AST', 0, true, true)} className="bg-gray-900 border border-gray-700 text-rose-400 font-black text-xs px-2.5 py-2 rounded-xl">-</button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('STL', 0, true, false)} className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Activity size={13} className="text-emerald-400" /> STL</button>
                              <button onClick={() => handleStat('STL', 0, true, true)} className="bg-gray-900 border border-gray-700 text-rose-400 font-black text-xs px-2.5 py-2 rounded-xl">-</button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('BLK', 0, true, false)} className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Award size={13} className="text-purple-400" /> BLK</button>
                              <button onClick={() => handleStat('BLK', 0, true, true)} className="bg-gray-900 border border-gray-700 text-rose-400 font-black text-xs px-2.5 py-2 rounded-xl">-</button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('TOV', 0, true, false)} className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><RotateCcw size={13} className="text-rose-400" /> TOV</button>
                              <button onClick={() => handleStat('TOV', 0, true, true)} className="bg-gray-900 border border-gray-700 text-rose-400 font-black text-xs px-2.5 py-2 rounded-xl">-</button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStat('PF', 0, true, false)} className="flex-1 bg-gray-800 border border-gray-700 text-orange-200 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1"><Flame size={13} className="text-orange-500" /> FAUL</button>
                              <button onClick={() => handleStat('PF', 0, true, true)} className="bg-gray-900 border border-gray-700 text-rose-400 font-black text-xs px-2.5 py-2 rounded-xl">-</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* MAÇI BİTİR BUTONU */}
                  <div className="pt-2">
                    <button onClick={finishMatch} className="w-full bg-rose-900/80 hover:bg-rose-800 border-2 border-rose-600 text-white font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl active:scale-95 transition">
                      <Square size={14} className="fill-white" /> Maçı Bitir & Tüm İstatistikleri Kaydet
                    </button>
                  </div>
                </>
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