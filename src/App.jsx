import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Activity, Play, Pause, RotateCcw, 
  Shield, Target, Award, Flame, UserPlus, ShieldPlus,
  BarChart2, ArrowLeftRight, CheckCircle2,
  PieChart, Printer, Settings, RefreshCw, BookOpen, Save,
  UserX, UserCheck, Trash2, Star, AlertCircle, Filter
} from 'lucide-react';

// Modüler Mimari
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
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'roster', 'stats', 'settings'
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

  const calcEFF = (p) => {
    if (!p) return 0;
    return (p.pts + p.reb + p.ast + p.stl + p.blk) - ((p.fga || 0) - (p.fgm || 0) + (p.tov || 0));
  };

  // TOGGLE HOME STARTER
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

  // TOGGLE AWAY STARTER
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
      setTeams(prev => [...prev, { ...created, players: [] }]);
      setSelectedRosterTeamId(created.id.toString());
      setNewTeam({ name: '', category: 'A Takım' });
      showNotification("Yeni takım başarıyla eklendi!", false);
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

  // START MATCH WITH VERIFIED FIRST 5
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
      
      const firstCourtPlayer = Object.values(initialStats).find(p => p.teamType === 'home' && p.isOnCourt)?.id;
      setSelectedPlayerId(firstCourtPlayer || null);

      setIsMatchStarted(true);
      setActiveTab('live');
      showNotification("Maç başarıyla başlatıldı!", false);
    } catch (err) {
      showNotification('Maç başlatılırken hata oluştu.');
    }
  };

  const handleSaveMatch = async () => {
    if (!activeMatchId) {
      showNotification("Aktif maç kaydı bulunamadı!");
      return;
    }

    try {
      await saveMatchStatsDB(activeMatchId, Object.values(matchStats), homeScore, awayScore);
      showNotification("Maç verileri Supabase'e başarıyla kaydedildi!", false);
      if (generalSelectedTeamId) {
        loadGeneralStats();
      }
    } catch (err) {
      showNotification("İstatistikler kaydedilirken hata oluştu.");
    }
  };

  const handleStat = (type, ptsValue = 0, isMake = true) => {
    if (!selectedPlayerId || !matchStats[selectedPlayerId]) return;

    setMatchStats(prev => {
      const updatedPlayer = { ...prev[selectedPlayerId] };
      if (type === 'PTS') {
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
      } else if (type === 'REB') updatedPlayer.reb += 1;
      else if (type === 'AST') updatedPlayer.ast += 1;
      else if (type === 'STL') updatedPlayer.stl += 1;
      else if (type === 'BLK') updatedPlayer.blk += 1;
      else if (type === 'TOV') updatedPlayer.tov += 1;
      else if (type === 'PF') updatedPlayer.pf += 1;

      return { ...prev, [selectedPlayerId]: updatedPlayer };
    });

    const player = matchStats[selectedPlayerId];
    if (type === 'PTS' && isMake) {
      if (player.teamType === 'home') setHomeScore(s => s + ptsValue);
      else setAwayScore(s => s + ptsValue);
    }
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
      <div className="w-full max-w-md bg-gray-900 min-h-screen flex flex-col shadow-2xl border-x border-gray-800 relative pb-20">
        
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
          <div className="flex justify-between items-center bg-gray-950/80 px-3 py-1.5 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-bold text-gray-300 truncate max-w-[80px]">{homeTeam?.name || 'Ev Sahibi'}</span>
              <span className="text-lg font-black text-orange-400">{homeScore}</span>
            </div>

            <div className="flex flex-col items-center px-2 border-x border-gray-800">
              <span className="text-[8px] font-extrabold text-orange-400 uppercase tracking-wider">{matchType}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-400">{quarter}P</span>
                <span className="text-xs font-mono font-bold text-white">{formatTime(secondsLeft)}</span>
                <button onClick={() => setIsRunning(!isRunning)} className="text-gray-300 hover:text-white transition">
                  {isRunning ? <Pause size={12} className="text-amber-400" /> : <Play size={12} className="text-emerald-400" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 flex-1">
              <span className="text-lg font-black text-gray-300">{awayScore}</span>
              <span className="text-xs font-bold text-gray-400 truncate max-w-[80px]">{awayTeam?.name || 'Rakip'}</span>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-3 space-y-3">

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

                  {/* MANDATORY STARTING 5 SELECTION PANELS */}
                  <div className="space-y-2 pt-2 border-t border-gray-700/80">
                    {/* HOME TEAM */}
                    <div className="bg-gray-900/90 p-2.5 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-bold text-orange-400">{homeTeam?.name} - İlk 5</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${homeStartingFive.length === 5 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                          {homeStartingFive.length}/5 Seçildi
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                        {(homeTeam?.players || []).map(p => {
                          const isInjured = p.status === 'injured';
                          const isSelected = homeStartingFive.includes(p.id);

                          return (
                            <button
                              key={p.id}
                              disabled={isInjured}
                              onClick={() => toggleHomeStarter(p.id)}
                              className={`p-1.5 rounded text-left border text-[10px] font-bold transition flex justify-between items-center ${
                                isInjured ? 'bg-rose-950/20 border-rose-900/40 text-gray-600 cursor-not-allowed' :
                                isSelected ? 'bg-orange-600/30 border-orange-500 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                              }`}
                            >
                              <span className="truncate">#{p.number} {p.name}</span>
                              <Star size={12} className={isSelected ? 'text-orange-400 fill-orange-400' : 'text-gray-600'} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* AWAY TEAM */}
                    <div className="bg-gray-900/90 p-2.5 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-bold text-blue-400">{awayTeam?.name} - İlk 5</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${awayStartingFive.length === 5 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                          {awayStartingFive.length}/5 Seçildi
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                        {(awayTeam?.players || []).map(p => {
                          const isInjured = p.status === 'injured';
                          const isSelected = awayStartingFive.includes(p.id);

                          return (
                            <button
                              key={p.id}
                              disabled={isInjured}
                              onClick={() => toggleAwayStarter(p.id)}
                              className={`p-1.5 rounded text-left border text-[10px] font-bold transition flex justify-between items-center ${
                                isInjured ? 'bg-rose-950/20 border-rose-900/40 text-gray-600 cursor-not-allowed' :
                                isSelected ? 'bg-blue-600/30 border-blue-500 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                              }`}
                            >
                              <span className="truncate">#{p.number} {p.name}</span>
                              <Star size={12} className={isSelected ? 'text-blue-400 fill-blue-400' : 'text-gray-600'} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={startMatch} 
                    disabled={!canStartMatch}
                    className={`w-full font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition ${
                      canStartMatch 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer' 
                        : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 size={16} /> 
                    {canStartMatch ? 'İlk 5 Onaylandı - Maçı Başlat' : 'Her iki takımdan 5 oyuncu seçilmelidir'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center bg-gray-950 p-1 rounded-xl border border-gray-800 gap-1">
                    <div className="flex flex-1">
                      <button 
                        onClick={() => setActiveTrackingTeam('home')}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${activeTrackingTeam === 'home' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {homeTeam?.name} (Ev)
                      </button>
                      <button 
                        onClick={() => setActiveTrackingTeam('away')}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${activeTrackingTeam === 'away' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {awayTeam?.name} (Rakip)
                      </button>
                    </div>

                    <button 
                      onClick={handleSaveMatch}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 shadow-md transition"
                      title="Maç İstatistiğini Veritabanına Kaydet"
                    >
                      <Save size={14} /> Kaydet
                    </button>
                  </div>

                  {/* COURT PLAYERS (5) */}
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sahadaki Oyuncular (5)</span>
                      <span className="text-[9px] text-orange-400 font-bold">Değişiklik için 🔄 ikonuna bas</span>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-1">
                      {courtPlayers.map(player => {
                        const isSelected = player.id === selectedPlayerId;
                        const isMarkedForSub = player.id === subOutPlayerId;

                        return (
                          <div key={player.id} className="relative">
                            <button
                              onClick={() => {
                                setSelectedPlayerId(player.id);
                                if (subOutPlayerId === player.id) setSubOutPlayerId(null);
                              }}
                              className={`w-full p-1 rounded-lg border text-left transition-all flex flex-col justify-between h-16 relative overflow-hidden ${
                                isMarkedForSub
                                  ? 'bg-rose-900/40 border-rose-500 text-rose-200 animate-pulse'
                                  : isSelected 
                                  ? 'bg-orange-600/20 border-orange-500 text-white shadow-lg' 
                                  : 'bg-gray-800/60 border-gray-700/60 text-gray-300 hover:bg-gray-800'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className={`text-[10px] font-black px-1 rounded ${isSelected ? 'bg-orange-500 text-black' : 'bg-gray-700 text-gray-200'}`}>
                                  #{player.number}
                                </span>
                                <span className="text-[8px] text-gray-400 font-bold">{player.position}</span>
                              </div>

                              <div className="text-[10px] font-bold leading-tight truncate my-0.5">{player.name.split(' ')[0]}</div>

                              <div className="flex justify-between items-center pt-0.5 border-t border-gray-700/40 text-[8px]">
                                <span className="font-extrabold text-orange-400">{player.pts}S</span>
                                <span className={`${player.pf >= 4 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>{player.pf}F</span>
                              </div>
                            </button>

                            <button 
                              onClick={() => setSubOutPlayerId(isMarkedForSub ? null : player.id)}
                              title="Oyuncu Değiştir"
                              className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border shadow-md transition ${
                                isMarkedForSub ? 'bg-rose-600 border-rose-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'
                              }`}
                            >
                              <RefreshCw size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SUBSTITUTION PANEL */}
                  {subOutPlayerId && (
                    <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-2.5 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
                          <ArrowLeftRight size={14} /> Girecek Oyuncuya Dokun (Kenar):
                        </span>
                        <button onClick={() => setSubOutPlayerId(null)} className="text-[10px] text-gray-400 hover:text-white underline">İptal</button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {benchPlayers.map(bPlayer => (
                          <button
                            key={bPlayer.id}
                            onClick={() => executeSub(bPlayer.id)}
                            className="bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/80 p-2 rounded-lg text-left transition flex items-center justify-between"
                          >
                            <div>
                              <div className="text-xs font-bold text-emerald-300">#{bPlayer.number} {bPlayer.name.split(' ')[0]}</div>
                              <div className="text-[8px] text-gray-400">{bPlayer.position} | {bPlayer.pts} PTS</div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400">GİR ➔</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  {selectedPlayer && (
                    <div className="bg-gray-800/80 rounded-xl p-2.5 border border-gray-700/80 space-y-2">
                      <div className="flex justify-between items-center pb-1.5 border-b border-gray-700/60">
                        <span className="text-xs font-bold text-white">#{selectedPlayer.number} {selectedPlayer.name} (Aktif)</span>
                        <span className="text-[10px] font-mono text-orange-400 font-bold">{selectedPlayer.pts} PTS | {selectedPlayer.reb} REB | {selectedPlayer.ast} AST</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => handleStat('PTS', 2, true)} className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 p-1.5 rounded-lg font-bold text-center text-xs">+2 Sayı</button>
                        <button onClick={() => handleStat('PTS', 3, true)} className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 p-1.5 rounded-lg font-bold text-center text-xs">+3 Sayı</button>
                        <button onClick={() => handleStat('PTS', 1, true)} className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 p-1.5 rounded-lg font-bold text-center text-xs">+1 Serbest</button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => handleStat('REB')} className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-200 p-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Shield size={12} className="text-blue-400" /> REB</button>
                        <button onClick={() => handleStat('AST')} className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-200 p-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Target size={12} className="text-amber-400" /> AST</button>
                        <button onClick={() => handleStat('STL')} className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-200 p-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Activity size={12} className="text-emerald-400" /> STL</button>
                        <button onClick={() => handleStat('BLK')} className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-200 p-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Award size={12} className="text-purple-400" /> BLK</button>
                        <button onClick={() => handleStat('TOV')} className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-200 p-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><RotateCcw size={12} className="text-rose-400" /> TOV</button>
                        <button onClick={() => handleStat('PF')} className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-200 p-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Flame size={12} className="text-orange-400" /> FAUL</button>
                      </div>
                    </div>
                  )}

                  {/* HALF COURT SHOT MAP */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Saha Şut Haritası (İşaretlemek için dokun)</span>
                    <div className="relative w-full aspect-[4/3] bg-orange-950/20 border-2 border-orange-500/40 rounded-xl overflow-hidden cursor-pointer" onClick={handleCourtClick}>
                      <svg className="absolute inset-0 w-full h-full stroke-orange-500/30 fill-none" viewBox="0 0 100 75">
                        <rect x="35" y="0" width="30" height="30" strokeWidth="1" />
                        <circle cx="50" cy="30" r="12" strokeWidth="1" />
                        <path d="M 10 0 L 10 15 A 40 40 0 0 0 90 15 L 90 0" strokeWidth="1.5" />
                        <line x1="40" y1="3" x2="60" y2="3" strokeWidth="2" stroke="white" />
                        <circle cx="50" cy="6" r="3" strokeWidth="1" stroke="orange" />
                      </svg>

                      {shots.map(shot => (
                        <div
                          key={shot.id}
                          style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
                          className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border flex items-center justify-center text-[7px] font-bold shadow-md ${
                            shot.made ? 'bg-emerald-500 border-emerald-300 text-black' : 'bg-rose-600 border-rose-300 text-white'
                          }`}
                        >
                          {shot.made ? '✓' : '✕'}
                        </div>
                      ))}
                    </div>
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
                <p className="text-[10px] text-gray-400">Takım ekleyin, kadro oluşturun ve oyuncu durumlarını yönetin</p>
              </div>

              {/* 1. YENİ TAKIM EKLEME */}
              <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-800 space-y-2">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1"><ShieldPlus size={14} /> Yeni Takım / Kulüp Ekle</span>
                <form onSubmit={handleAddTeam} className="flex gap-2">
                  <input type="text" placeholder="Takım Adı" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="flex-1 bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded-lg" required />
                  <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-3 py-2 rounded-lg text-xs">Ekle</button>
                </form>
              </div>

              {/* 2. MEVCUT TAKIM SEÇİMİ */}
              <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Yönetilecek Takımı Seç</label>
                <select value={selectedRosterTeamId} onChange={e => setSelectedRosterTeamId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold">
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                </select>
              </div>

              {/* 3. OYUNCU LİSTESİ VE DÜZENLEME */}
              {selectedRosterTeam && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <Users size={14} className="text-orange-400" /> Kadro ({selectedRosterTeam.players?.length || 0} Oyuncu)
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {(selectedRosterTeam.players || []).map(p => {
                      const isInjured = p.status === 'injured';

                      return (
                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs transition ${
                          isInjured ? 'bg-rose-950/20 border-rose-900/50 opacity-60' : 'bg-gray-800/60 border-gray-700/60'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-orange-400 w-5">#{p.number}</span>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1">
                                {p.name}
                                {isInjured && <span className="text-[8px] bg-rose-900 text-rose-300 font-bold px-1 rounded">SAKAT</span>}
                              </div>
                              <div className="text-[8px] text-gray-400">{p.position} | {p.height} | {p.weight} | {p.age} Yaş</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleToggleStatus(p)} 
                              title={isInjured ? "Aktif Yap" : "Sakat İşaretle"} 
                              className={`p-1.5 rounded transition ${isInjured ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/40' : 'text-rose-400 hover:text-rose-300 bg-rose-950/40'}`}
                            >
                              {isInjured ? <UserCheck size={14} /> : <UserX size={14} />}
                            </button>

                            <button onClick={() => handleDeletePlayer(p.id)} title="Oyuncuyu Sil" className="p-1.5 text-gray-500 hover:text-rose-400 transition">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. OYUNCU EKLEME FORMU */}
              <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/80 space-y-2">
                <span className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1">
                  <UserPlus size={14} className="text-orange-400" /> Takıma Oyuncu Ekle (Forma # Benzersiz)
                </span>

                <form onSubmit={handleAddPlayer} className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="Ad Soyad" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded col-span-2" required />
                    <input type="number" placeholder="Forma #" value={newPlayer.number} onChange={e => setNewPlayer({...newPlayer, number: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-2 rounded" required />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <select value={newPlayer.position} onChange={e => setNewPlayer({...newPlayer, position: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-1.5 rounded">
                      <option value="PG">PG</option>
                      <option value="SG">SG</option>
                      <option value="SF">SF</option>
                      <option value="PF">PF</option>
                      <option value="C">C</option>
                    </select>
                    <input type="number" placeholder="Boy (cm)" value={newPlayer.height} onChange={e => setNewPlayer({...newPlayer, height: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-1.5 rounded" />
                    <input type="number" placeholder="Kilo (kg)" value={newPlayer.weight} onChange={e => setNewPlayer({...newPlayer, weight: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-1.5 rounded" />
                    <input type="number" placeholder="Yaş" value={newPlayer.age} onChange={e => setNewPlayer({...newPlayer, age: e.target.value})} className="bg-gray-900 border border-gray-700 text-xs text-white p-1.5 rounded" />
                  </div>

                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1">
                    <UserPlus size={14} /> Oyuncuyu Kaydet
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: MATCH STATS & GENERAL STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-3">
              <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                <button 
                  onClick={() => setStatsViewMode('match')} 
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${statsViewMode === 'match' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Maç İstatistiği (Canlı)
                </button>
                <button 
                  onClick={() => setStatsViewMode('general')} 
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${statsViewMode === 'general' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Genel / Sezonluk İstatistikler
                </button>
              </div>

              {statsViewMode === 'match' ? (
                <>
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Maç İstatistiği & Box Score</h3>
                    <span className="text-[10px] text-orange-400 font-bold">{matchType}</span>
                  </div>

                  <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs">
                    <button onClick={() => setStatsTeamFilter('all')} className={`flex-1 py-1 rounded-lg font-bold transition ${statsTeamFilter === 'all' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Tüm Oyuncular</button>
                    <button onClick={() => setStatsTeamFilter('home')} className={`flex-1 py-1 rounded-lg font-bold transition ${statsTeamFilter === 'home' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>{homeTeam?.name || 'Ev Sahibi'}</button>
                    <button onClick={() => setStatsTeamFilter('away')} className={`flex-1 py-1 rounded-lg font-bold transition ${statsTeamFilter === 'away' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>{awayTeam?.name || 'Rakip'}</button>
                  </div>

                  <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-gray-800/80 text-gray-400 uppercase text-[9px]">
                        <tr>
                          <th className="p-2">Oyuncu</th>
                          <th className="p-2 text-center">PTS</th>
                          <th className="p-2 text-center">EFF</th>
                          <th className="p-2 text-center">REB</th>
                          <th className="p-2 text-center">AST</th>
                          <th className="p-2 text-center">FAUL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {filteredBoxScore.map(p => (
                          <tr key={p.id} className={p.teamType === 'home' ? 'bg-orange-500/5' : 'bg-blue-500/5'}>
                            <td className="p-2 font-medium">
                              <div className="font-bold text-white">#{p.number} {p.name}</div>
                              <div className="text-[8px] text-gray-500">{p.teamType === 'home' ? 'EV' : 'RAKİP'} • {p.position}</div>
                            </td>
                            <td className="p-2 text-center font-bold text-orange-400">{p.pts}</td>
                            <td className="p-2 text-center font-bold text-emerald-400">{calcEFF(p)}</td>
                            <td className="p-2 text-center">{p.reb}</td>
                            <td className="p-2 text-center">{p.ast}</td>
                            <td className="p-2 text-center">{p.pf}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 space-y-2">
                    <div className="flex items-center gap-1 text-xs font-bold text-orange-400 uppercase tracking-wider">
                      <Filter size={14} /> Sezon Filtreleri
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 font-bold block mb-1">Takım Seç</label>
                        <select 
                          value={generalSelectedTeamId} 
                          onChange={e => setGeneralSelectedTeamId(e.target.value)} 
                          className="w-full bg-gray-950 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold"
                        >
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 font-bold block mb-1">Maç Türü</label>
                        <select 
                          value={generalMatchTypeFilter} 
                          onChange={e => setGeneralMatchTypeFilter(e.target.value)} 
                          className="w-full bg-gray-950 border border-gray-700 text-xs text-white p-2 rounded-lg font-bold"
                        >
                          <option value="all">Tüm Maçlar</option>
                          <option value="Lig Maçı">Lig Maçları</option>
                          <option value="Turnuva">Turnuvalar</option>
                          <option value="Hazırlık Maçı">Hazırlık Maçları</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
                    {generalLoading ? (
                      <div className="p-4 text-center text-xs text-orange-400 font-bold">Veriler hesaplanıyor...</div>
                    ) : generalStatsList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-500">Seçili filtrelere ait kayıtlı maç istatistiği bulunamadı.</div>
                    ) : (
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-gray-800/80 text-gray-400 uppercase text-[9px]">
                          <tr>
                            <th className="p-2">Oyuncu</th>
                            <th className="p-1 text-center">OM</th>
                            <th className="p-1 text-center">PTS</th>
                            <th className="p-1 text-center">EFF</th>
                            <th className="p-1 text-center">REB</th>
                            <th className="p-1 text-center">AST</th>
                            <th className="p-1 text-center">STL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {generalStatsList.map(p => (
                            <tr key={p.id} className="hover:bg-gray-800/50">
                              <td className="p-2 font-medium">
                                <div className="font-bold text-white">#{p.number} {p.name}</div>
                                <div className="text-[8px] text-gray-500">{p.position}</div>
                              </td>
                              <td className="p-1 text-center font-mono text-gray-400">{p.gp}</td>
                              <td className="p-1 text-center font-bold text-orange-400">{p.pts}</td>
                              <td className="p-1 text-center font-bold text-emerald-400">{calcEFF(p)}</td>
                              <td className="p-1 text-center">{p.reb}</td>
                              <td className="p-1 text-center">{p.ast}</td>
                              <td className="p-1 text-center">{p.stl}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GLOSSARY */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1 border-b border-gray-800 pb-1.5">
                  <BookOpen size={14} /> İstatistik Sözlüğü
                </span>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                  <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/40"><strong className="text-orange-400">OM (Oynanan Maç):</strong> Toplam maç sayısı.</div>
                  <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/40"><strong className="text-orange-400">PTS:</strong> Atılan toplam sayı.</div>
                  <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/40"><strong className="text-blue-400">REB:</strong> Alınan toplam ribaund.</div>
                  <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/40"><strong className="text-amber-400">AST:</strong> Sayı pası (Asist).</div>
                  <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/40"><strong className="text-emerald-400">STL:</strong> Top çalma.</div>
                  <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/40"><strong className="text-purple-400">BLK:</strong> Blok sayısı.</div>
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