import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Activity, Play, Pause, RotateCcw, 
  Shield, Target, Award, Flame, UserPlus, ShieldPlus,
  BarChart2, ArrowLeftRight, CheckCircle2,
  PieChart, Printer, Settings, RefreshCw, BookOpen, Save,
  UserX, UserCheck, Trash2, Star, AlertCircle, Filter, CloudCheck, Undo2, Minus
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

  // MATCH STATE
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [homeTeamId, setHomeTeamId] = useState(null);
  const [awayTeamId, setAwayTeamId] = useState(null);
  const [matchType, setMatchType] = useState('Lig Maçı');
  const [activeTrackingTeam, setActiveTrackingTeam] = useState('home');
  const [isMatchStarted, setIsMatchStarted] = useState(false);

  // STARTING 5 STATE
  const [homeStartingFive, setHomeStartingFive] = useState([]);
  const [awayStartingFive, setAwayStartingFive] = useState([]);

  const [matchStats, setMatchStats] = useState({});
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

  const [secondsLeft, setSecondsLeft] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [quarter, setQuarter] = useState(1);

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [subOutPlayerId, setSubOutPlayerId] = useState(null);
  const [shots, setShots] = useState([]);

  // ACTION HISTORY FOR UNDO
  const [actionHistory, setActionHistory] = useState([]);

  // AUTO SAVE INDICATOR STATE
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

  // AUTOMATIC PERIODIC SAVE EFFECT (HER 15 SANİYEDE BİR OTO-KAYIT)
  useEffect(() => {
    let autoSaveTimer;
    if (isMatchStarted && activeMatchId) {
      autoSaveTimer = setInterval(async () => {
        await saveMatchStatsDB(activeMatchId, Object.values(matchStats), homeScore, awayScore);
        const now = new Date();
        setLastSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
      }, 15000);
    }
    return () => clearInterval(autoSaveTimer);
  }, [isMatchStarted, activeMatchId, matchStats, homeScore, awayScore]);

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

  // PIR (PERFORMANCE INDEX RATING) HESAPLAMA
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

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name) return;
    try {
      const created = await addTeamDB(newTeam.name, newTeam.category);
      await loadTeamsData();
      setSelectedRosterTeamId(created.id.toString());
      setNewTeam({ name: '', category: 'A Takım' });
      showNotification("Yeni takım ve 15 varsayılan oyuncu eklendi!", false);
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
        showNotification(`HATA: ${targetTeam.name} takımında #${newPlayer.number} numaralı oyuncu zaten mevcut!`);
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
      showNotification("Oyuncu başarıyla eklendi!", false);
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
      showNotification("Oyuncu durumu güncellenemedi.");
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!window.confirm("Bu oyuncuyu silmek istediğinize emin misiniz?")) return;
    try {
      await deletePlayerDB(playerId);
      await loadTeamsData();
      showNotification("Oyuncu kadrodan silindi.", false);
    } catch (err) {
      showNotification("Oyuncu silinemedi.");
    }
  };

  const startMatch = async () => {
    if (homeTeamId === awayTeamId) {
      showNotification("Ev sahibi ve rakip takım aynı olamaz!");
      return;
    }

    if (homeStartingFive.length !== 5) {
      showNotification(`Ev Sahibi takımdan tam 5 oyuncu seçmelisiniz! (Şu an: ${homeStartingFive.length}/5)`);
      return;
    }

    if (awayStartingFive.length !== 5) {
      showNotification(`Rakip takımdan tam 5 oyuncu seçmelisiniz! (Şu an: ${awayStartingFive.length}/5)`);
      return;
    }

    const homeTeam = teams.find(t => t.id === homeTeamId);
    const awayTeam = teams.find(t => t.id === awayTeamId);

    try {
      const matchRecord = await createMatchDB(homeTeamId, awayTeamId, matchType);
      setActiveMatchId(matchRecord.id);

      const initialStats = {};

      (homeTeam.players || []).forEach(p => {
        if (p.status === 'injured') return;
        initialStats[p.id] = { 
          ...p, 
          teamType: 'home', 
          isOnCourt: homeStartingFive.includes(p.id), 
          pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, pm3: 0, pa3: 0, ftm: 0, fta: 0 
        };
      });

      (awayTeam.players || []).forEach(p => {
        if (p.status === 'injured') return;
        initialStats[p.id] = { 
          ...p, 
          teamType: 'away', 
          isOnCourt: awayStartingFive.includes(p.id), 
          pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, pm3: 0, pa3: 0, ftm: 0, fta: 0 
        };
      });

      setMatchStats(initialStats);
      setHomeScore(0);
      setAwayScore(0);
      setShots([]);
      setActionHistory([]);
      
      const firstCourtPlayer = Object.values(initialStats).find(p => p.teamType === 'home' && p.isOnCourt)?.id;
      setSelectedPlayerId(firstCourtPlayer || null);

      setIsMatchStarted(true);
      setActiveTab('live');
      showNotification("Maç başlatıldı! Otomatik kayıt aktif.", false);
    } catch (err) {
      showNotification('Maç başlatılırken hata oluştu.');
    }
  };

  // İSTATİSTİK EKLEME VEYA AZALTMA (PLUS / MINUS)
  const handleStat = (type, ptsValue = 0, isMake = true, isSubtract = false) => {
    if (!selectedPlayerId || !matchStats[selectedPlayerId]) return;

    const player = matchStats[selectedPlayerId];

    if (!isSubtract) {
      setActionHistory(prev => [
        ...prev,
        {
          playerId: selectedPlayerId,
          type,
          ptsValue,
          isMake,
          teamType: player.teamType,
          timestamp: Date.now()
        }
      ]);
    }

    setMatchStats(prev => {
      const updatedPlayer = { ...prev[selectedPlayerId] };

      if (type === 'PTS') {
        if (isSubtract) {
          updatedPlayer.pts = Math.max(0, updatedPlayer.pts - ptsValue);
          if (ptsValue === 3) {
            updatedPlayer.pm3 = Math.max(0, updatedPlayer.pm3 - (isMake ? 1 : 0));
            updatedPlayer.pa3 = Math.max(0, updatedPlayer.pa3 - 1);
          } else if (ptsValue === 2) {
            updatedPlayer.fgm = Math.max(0, updatedPlayer.fgm - (isMake ? 1 : 0));
            updatedPlayer.fga = Math.max(0, updatedPlayer.fga - 1);
          } else if (ptsValue === 1) {
            updatedPlayer.ftm = Math.max(0, updatedPlayer.ftm - (isMake ? 1 : 0));
            updatedPlayer.fta = Math.max(0, updatedPlayer.fta - 1);
          }
        } else {
          updatedPlayer.pts += ptsValue;
          if (ptsValue === 3) {
            updatedPlayer.pm3 += isMake ? 1 : 0;
            updatedPlayer.pa3 += 1;
          } else if (ptsValue === 2) {
            updatedPlayer.fgm += isMake ? 1 : 0;
            updatedPlayer.fga += 1;
          } else if (ptsValue === 1) {
            updatedPlayer.ftm += isMake ? 1 : 0;
            updatedPlayer.fta += 1;
          }
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

    if (isSubtract) {
      showNotification("İstatistik düşürüldü (-)", false);
    }
  };

  // SON İŞLEMİ GERİ ALMA (UNDO / DÜZELTME)
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

  const handleCourtClick = (e) => {
    if (!selectedPlayerId) {
      showNotification('Lütfen önce sahadan bir oyuncu seçin!');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const is3pt = y > 55 || x < 15 || x > 85;
    const shotVal = is3pt ? 3 : 2;
    const made = window.confirm(`${is3pt ? '3 Sayılık' : '2 Sayılık'} Atış İSABETLİ mi?`);

    setShots(prev => [...prev, {
      id: Date.now(),
      playerId: selectedPlayerId,
      x, y, made,
      type: is3pt ? '3PT' : '2PT'
    }]);

    handleStat('PTS', made ? shotVal : 0, made);
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

  const canStartMatch = homeStartingFive.length === 5 && awayStartingFive.length === 5;

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
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block">Yeni Maç & İlk 5 Seçimi</span>
                    <p className="text-[10px] text-gray-400">Maçı başlatmak için her iki takımdan tam 5 oyuncu seçilmelidir.</p>
                  </div>
                  
                  <div className="space-y-2 text-left">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold block mb-1">Maç Türü</label>
                      <select value={matchType} onChange={e => setMatchType(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold">
                        <option value="Lig Maçı">Lig Maçı</option>
                        <option value="Hazırlık Maçı">Hazırlık Maçı</option>
                        <option value="Turnuva">Turnuva</option>
                      </select>