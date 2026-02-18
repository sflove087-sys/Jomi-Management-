
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LandRecord, CollectionEntry, AppConfig } from './types';
import StatCard from './components/StatCard';
import RecordForm from './components/RecordForm';
import CollectionForm from './components/CollectionForm';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('jomi_config_v2');
    return saved ? JSON.parse(saved) : {
      businessName: 'জমি বন্ধক ম্যানেজার',
      profitPercentage: 9,
      warningDays: 15,
      currency: '৳',
      theme: 'light',
      googleSheetUrl: 'https://script.google.com/macros/s/AKfycbxK4JSotFBwBWxoHJECh6Y6OROSrTqyp-QqFwiNVmwbenV0ouLgQKZcV-D7x6NLVcvs/exec',
      spreadsheetUrl: '',
      autoSync: true,
      restrictCollectionToExpired: false
    };
  });

  const [records, setRecords] = useState<LandRecord[]>(() => {
    const saved = localStorage.getItem('jomi_records_v4');
    return saved ? JSON.parse(saved) : [];
  });

  const [lastSync, setLastSync] = useState<string>(localStorage.getItem('jomi_last_sync') || 'কখনো নয়');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandRecord | null>(null);
  const [collectingFor, setCollectingFor] = useState<LandRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<LandRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('ডাটা আপডেট হচ্ছে...');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });

  const [liveAutoMode, setLiveAutoMode] = useState(true);
  const isDark = config.theme === 'dark';

  useEffect(() => {
    localStorage.setItem('jomi_records_v4', JSON.stringify(records));
    localStorage.setItem('jomi_config_v2', JSON.stringify(config));
    document.title = config.businessName;
  }, [records, config]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    let interval: any;
    if (liveAutoMode && config.googleSheetUrl) {
      interval = setInterval(() => {
        loadFromCloud(true);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [liveAutoMode, config.googleSheetUrl]);

  const syncActionWithCloud = async (action: 'add' | 'edit' | 'delete' | 'sync', data: any) => {
    if (!config.googleSheetUrl) return;
    setIsSyncing(true);
    setSyncStatusMsg(`ক্লাউডে ${action === 'delete' ? 'মুছে ফেলা' : 'সেভ'} হচ্ছে...`);
    
    try {
      await fetch(config.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...data }),
      });
      
      const time = new Date().toLocaleString('bn-BD');
      setLastSync(time);
      localStorage.setItem('jomi_last_sync', time);
      setSyncStatusMsg('ক্লাউডে সফলভাবে সেভ করা হয়েছে');
      
      setTimeout(() => setSyncStatusMsg(null), 3000);
      return true;
    } catch (error) {
      setNotification({ message: 'ক্লাউড কানেকশন সমস্যা।', type: 'error' });
      setSyncStatusMsg('সিঙ্ক ব্যর্থ হয়েছে');
      setTimeout(() => setSyncStatusMsg(null), 3000);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const loadFromCloud = async (isSilent = false) => {
    if (!config.googleSheetUrl) return;
    if (!isSilent) {
      setLoadingMessage('গুগল শিট থেকে ডাটা আনা হচ্ছে...');
      setIsLoading(true);
    }
    try {
      const response = await fetch(`${config.googleSheetUrl}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      if (result.status === 'success') {
        const newRecordsJson = JSON.stringify(result.records);
        if (newRecordsJson !== JSON.stringify(records)) {
          setRecords(result.records || []);
        }
        const time = new Date().toLocaleString('bn-BD');
        setLastSync(time);
        if (!isSilent) setNotification({ message: 'ডাটা রিফ্রেশ করা হয়েছে।', type: 'success' });
      }
    } catch (error) {
      if (!isSilent) setNotification({ message: 'ডাটা লোড করা যায়নি।', type: 'error' });
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const handleSaveRecord = async (recordData: any) => {
    setLoadingMessage(recordData.id ? 'চুক্তি সংশোধন হচ্ছে...' : 'নতুন চুক্তি সংরক্ষণ হচ্ছে...');
    setIsLoading(true);
    let updatedRecords: LandRecord[];
    let action: 'add' | 'edit' = 'add';
    let payload: any;
    if (recordData.id) {
      action = 'edit';
      updatedRecords = records.map(r => r.id === recordData.id ? { ...r, ...recordData } : r);
      payload = { record: { ...recordData } };
      setNotification({ message: 'সংশোধন সম্পন্ন হয়েছে।', type: 'success' });
    } else {
      action = 'add';
      const newRecord = { ...recordData, id: crypto.randomUUID(), collections: [] };
      updatedRecords = [...records, newRecord];
      payload = { record: newRecord };
      setNotification({ message: 'নিবন্ধন সম্পন্ন হয়েছে।', type: 'success' });
    }
    setRecords(updatedRecords);
    setIsFormOpen(false);
    setEditingRecord(null);
    setIsLoading(false);
    if (config.autoSync) await syncActionWithCloud(action, payload);
  };

  const openDeleteRecordDialog = (id: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'চুক্তি মুছে ফেলুন',
      message: `আপনি কি নিশ্চিত যে "${title}" চুক্তিটি মুছে ফেলতে চান? এটি ক্লাউড থেকেও চিরতরে মুছে যাবে।`,
      type: 'danger',
      onConfirm: () => handleDeleteRecord(id)
    });
  };

  const handleDeleteRecord = async (id: string) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setLoadingMessage("সার্ভার থেকে মুছে ফেলা হচ্ছে...");
    setIsLoading(true);
    try {
      const updatedRecords = records.filter(r => r.id !== id);
      setRecords(updatedRecords);
      setNotification({ message: 'চুক্তিটি মুছে ফেলা হয়েছে।', type: 'success' });
      setIsLoading(false);
      if (config.googleSheetUrl && config.autoSync) await syncActionWithCloud('delete', { id });
    } catch (error) {
      setNotification({ message: 'মুছে ফেলতে সমস্যা হয়েছে।', type: 'error' });
      setIsLoading(false);
    }
  };

  const openDeleteCollectionDialog = (recordId: string, entryId: string, amount: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'আদায় মুছুন',
      message: `আপনি কি নিশ্চিত যে ${amount.toLocaleString()} ৳ আদায়ের রেকর্ডটি মুছে ফেলতে চান?`,
      type: 'danger',
      onConfirm: () => handleDeleteCollectionEntry(recordId, entryId)
    });
  };

  const handleDeleteCollectionEntry = async (recordId: string, entryId: string) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setLoadingMessage("আদায়টি মুছে ফেলা হচ্ছে...");
    setIsLoading(true);
    let updatedRec: LandRecord | null = null;
    const updatedRecords = records.map(r => {
      if (r.id === recordId) {
        updatedRec = { ...r, collections: (r.collections || []).filter(c => c.id !== entryId) };
        return updatedRec;
      }
      return r;
    });
    setRecords(updatedRecords);
    if (viewingRecord?.id === recordId && updatedRec) setViewingRecord(updatedRec);
    setNotification({ message: 'আদায়টি মুছে ফেলা হয়েছে।', type: 'success' });
    setIsLoading(false);
    if (config.autoSync && updatedRec) await syncActionWithCloud('edit', { record: updatedRec });
  };

  const handleSaveCollection = async (entries: Omit<CollectionEntry, 'id'>[], newDuration?: string) => {
    if (!collectingFor) return;
    setLoadingMessage('কিস্তি আদায় সম্পন্ন হচ্ছে...');
    setIsLoading(true);
    const newEntries = entries.map(e => ({ id: crypto.randomUUID(), ...e }));
    let updatedRec: LandRecord | null = null;
    const updatedRecords = records.map(r => {
      if (r.id === collectingFor.id) {
        updatedRec = { 
          ...r, 
          collections: [...(r.collections || []), ...newEntries],
          duration: newDuration || r.duration 
        };
        return updatedRec;
      }
      return r;
    });
    setRecords(updatedRecords);
    setCollectingFor(null);
    setNotification({ message: 'কিস্তি আদায় সফল হয়েছে!', type: 'success' });
    setIsLoading(false);
    if (config.autoSync && updatedRec) await syncActionWithCloud('edit', { record: updatedRec });
  };

  const getExpiryInfo = (record: LandRecord) => {
    if (!record.startDate || !record.duration) return { expired: false };
    const start = new Date(record.startDate);
    const parts = record.duration.split(' ');
    const val = parseInt(parts[0]) || 0;
    const unit = parts[1];
    const expiry = new Date(start);
    if (expiry.toString() === 'Invalid Date') return { expired: false };
    if (unit === 'বছর') expiry.setFullYear(expiry.getFullYear() + val);
    else if (unit === 'মাস') expiry.setMonth(expiry.getMonth() + val);
    else expiry.setDate(expiry.getDate() + val);
    return { expired: new Date() > expiry, date: expiry };
  };

  const stats = useMemo(() => {
    const investment = records.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const collected = records.reduce((acc, r) => acc + (r.collections?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0), 0);
    const active = records.filter(r => !getExpiryInfo(r).expired).length;
    return { investment, collected, active, total: records.length };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const search = searchTerm.toLowerCase();
      const { expired } = getExpiryInfo(r);
      const matchesSearch = r.title.toLowerCase().includes(search) || r.ownerName.toLowerCase().includes(search) || r.mobile.includes(search) || r.contractorName?.toLowerCase().includes(search);
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' && !expired) || (statusFilter === 'EXPIRED' && expired);
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const getInitials = (name: string) => (name || "?").split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleCloudPrint = (id: string) => {
    if (!config.googleSheetUrl) {
      setNotification({ message: "ক্লাউড ইউআরএল কনফিগার করা নেই!", type: 'error' });
      return;
    }
    const printUrl = `${config.googleSheetUrl}?action=print&id=${id}`;
    window.open(printUrl, '_blank');
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className={`min-h-screen transition-all ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#f8f9fa] text-slate-900'}`}>
      
      {/* 5s Auto Sync Notification */}
      {(isSyncing || syncStatusMsg || liveAutoMode) && (
        <div className={`fixed bottom-6 right-6 z-[2800] px-5 py-3 rounded-2xl shadow-2xl flex flex-col gap-1 print:hidden border border-white/10 ${isDark ? 'bg-slate-900/90' : 'bg-[#002b5c]/90 text-white'} backdrop-blur-md`}>
           <div className="flex items-center gap-4">
              <div className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`}></div>
              <p className="text-[9px] font-black uppercase tracking-widest leading-none">
                {isSyncing ? 'ক্লাউড সিঙ্ক হচ্ছে...' : (syncStatusMsg || 'Live Sync (5s)')}
              </p>
           </div>
           {liveAutoMode && !isSyncing && (
             <div className="w-full bg-white/10 h-0.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-400 h-full animate-[progress_5s_linear_infinite]"></div>
             </div>
           )}
        </div>
      )}

      {/* Deletion Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[4000] flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
          <div className={`w-full max-sm max-w-sm rounded-[3rem] p-10 border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className={`w-16 h-16 rounded-3xl mb-6 flex items-center justify-center text-2xl ${confirmModal.type === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
               {confirmModal.type === 'danger' ? '🗑️' : '⚠️'}
            </div>
            <h3 className="text-[11px] font-black uppercase tracking-tight mb-3 dark:text-white">{confirmModal.title}</h3>
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-4">
               <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} className={`flex-1 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>বাতিল</button>
               <button onClick={confirmModal.onConfirm} className={`flex-1 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest text-white shadow-xl transition-all ${confirmModal.type === 'danger' ? 'bg-rose-600 shadow-rose-600/20' : 'bg-amber-500 shadow-amber-500/20'}`}>নিশ্চিত</button>
            </div>
          </div>
        </div>
      )}

      {/* Main View */}
      <div className="flex flex-col lg:flex-row min-h-screen print:hidden">
        <aside className={`w-full lg:w-64 p-6 sticky top-0 h-auto lg:h-screen flex flex-col ${isDark ? 'bg-slate-900 border-r border-slate-800' : 'bg-[#002b5c] text-white shadow-2xl shadow-[#002b5c]/20'}`}>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-[#002b5c] shadow-xl">
              <span className="text-[14px]">🏠</span>
            </div>
            <div>
              <h1 className="text-[10px] font-black leading-none uppercase tracking-tighter">{config.businessName}</h1>
              <p className="text-[8px] uppercase tracking-widest text-amber-400 font-bold mt-1 opacity-80">Live Engine V5</p>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-[9px] uppercase bg-amber-400 text-[#002b5c] shadow-xl transition-all hover:translate-x-1"><span className="text-[12px]">📊</span> ড্যাশবোর্ড</button>
            <button onClick={() => loadFromCloud()} disabled={isLoading || isSyncing} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-[9px] uppercase text-slate-300 hover:bg-white/10 transition-all border border-transparent hover:border-white/10"><span className={`text-[12px] ${(isLoading || isSyncing) ? 'animate-spin' : ''}`}>🔄</span> রিফ্রেশ ডাটা</button>
          </div>
          <div className="mt-auto p-5 rounded-3xl bg-white/5 border border-white/5 text-center">
            <p className="text-[8px] font-black uppercase text-emerald-400 mb-2 flex items-center justify-center gap-2 tracking-widest"><span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`}></span>লাইভ আপডেট সচল</p>
            <p className="text-[8px] text-slate-400 font-bold opacity-70">আপডেট: {lastSync}</p>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-10 space-y-10 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-black text-[#002b5c] dark:text-white tracking-tight uppercase">চুক্তিনামা ড্যাশবোর্ড</h2>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setConfig({...config, theme: isDark ? 'light' : 'dark'})} className={`w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg transition-all hover:scale-110 ${isDark ? 'bg-slate-800 text-amber-400' : 'bg-white text-slate-600'}`}>{isDark ? '🌞' : '🌙'}</button>
              <button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} className="bg-gradient-to-r from-[#002b5c] to-indigo-900 dark:from-amber-400 dark:to-amber-500 dark:text-[#002b5c] text-white px-8 py-4 rounded-2xl font-black text-[9px] uppercase shadow-2xl hover:shadow-indigo-500/20 active:scale-95 transition-all">নতুন চুক্তি নিবন্ধন +</button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="মোট বিনিয়োগ" value={`${stats.investment.toLocaleString()} ৳`} icon="💰" color="bg-indigo-600" theme={config.theme} />
            <StatCard label="মোট আদায়" value={`${stats.collected.toLocaleString()} ৳`} icon="📈" color="bg-emerald-600" theme={config.theme} />
            <StatCard label="সচল চুক্তি" value={stats.active} icon="✅" color="bg-[#002b5c]" theme={config.theme} />
            <StatCard label="মোট চুক্তি" value={stats.total} icon="📄" color="bg-rose-500" theme={config.theme} />
          </div>

          <div className="flex flex-col xl:flex-row gap-6 justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
             <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl shrink-0 overflow-x-auto no-scrollbar">
                {['ALL', 'ACTIVE', 'EXPIRED'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-8 py-4 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${statusFilter === s ? 'bg-[#002b5c] text-white shadow-xl' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-900'}`}>{s === 'ALL' ? 'সকল চুক্তি' : s === 'ACTIVE' ? 'সচল' : 'মেয়াদ উত্তীর্ণ'}</button>
                ))}
             </div>
             <div className="relative w-full xl:w-96 group">
                <input type="text" placeholder="মালিক, চুক্তিধর বা টাইটেল দিয়ে খুঁজুন..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full py-5 pl-14 pr-6 rounded-2xl border outline-none font-black text-[9px] shadow-sm transition-all ${isDark ? 'bg-slate-950 border-slate-800 focus:border-amber-400' : 'bg-white border-slate-200 focus:border-[#002b5c] focus:shadow-indigo-100'}`} />
                <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-30 text-[14px] group-focus-within:opacity-100 group-focus-within:text-indigo-500 transition-all">🔍</span>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 pb-20">
            {filteredRecords.map(r => {
              const { expired } = getExpiryInfo(r);
              const total = r.collections?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0;
              return (
                <div key={r.id} className={`group flex flex-col rounded-[3rem] border-2 transition-all hover:shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} ${expired ? 'grayscale-[0.3] opacity-90' : 'hover:-translate-y-2'}`}>
                  <div className={`p-7 flex justify-between items-center border-b-2 border-inherit ${isDark ? 'bg-slate-950/20' : 'bg-slate-50/50'}`}>
                    <div className="flex gap-4 items-center">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 font-black text-[10px] shadow-lg ${expired ? 'bg-gradient-to-br from-rose-400 to-rose-600' : 'bg-gradient-to-br from-[#002b5c] to-indigo-800'}`}>{getInitials(r.ownerName)}</div>
                      <div>
                        <h4 className="text-[10px] font-black text-[#002b5c] dark:text-white leading-tight uppercase tracking-tight">{r.title}</h4>
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md mt-1 inline-block ${expired ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{expired ? 'মেয়াদ উত্তীর্ণ' : 'সচল চুক্তি'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                       <button onClick={() => setViewingRecord(r)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all text-[12px]" title="বিস্তারিত">👁️</button>
                       <button onClick={() => handleCloudPrint(r.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all text-[12px]" title="প্রিন্ট করুন">🖨️</button>
                       <button onClick={() => { setEditingRecord(r); setIsFormOpen(true); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all text-[12px]" title="সংশোধন">✏️</button>
                    </div>
                  </div>
                  <div className="p-8 space-y-7 flex-1">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">জমির মালিক / চুক্তিধর</p>
                        <p className="font-black text-[10px] uppercase text-slate-800 dark:text-slate-100">{r.ownerName}</p>
                        <p className="text-[8px] text-indigo-500 font-bold uppercase">চুক্তিধর: {r.contractorName || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">জমির পরিমাণ</p>
                        <p className="font-black text-[10px] text-slate-800 dark:text-slate-100">{r.area} শতক</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-inherit">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">বিনিয়োগ</p>
                        <p className="text-[10px] font-black text-[#002b5c] dark:text-amber-400">{r.amount.toLocaleString()} ৳</p>
                      </div>
                      <div className="p-5 rounded-[2rem] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/10">
                        <p className="text-[8px] font-black text-emerald-600 uppercase mb-1.5 tracking-wider">আদায়কৃত</p>
                        <p className="text-[10px] font-black text-emerald-600">{total.toLocaleString()} ৳</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-8 pb-8 flex gap-4">
                    <button onClick={(e) => { e.stopPropagation(); setCollectingFor(r); }} className={`flex-1 py-5 rounded-[1.5rem] font-black text-[9px] uppercase tracking-[0.2em] shadow-xl transition-all bg-emerald-600 text-white shadow-emerald-600/30 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95`}>কিস্তি আদায় করুন</button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Viewing Record Details / Visual Card Print Layout */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-2xl z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-500 print:bg-white print:p-0">
          <div className={`w-full max-w-5xl rounded-[4rem] overflow-hidden border border-inherit shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            
            <div className="p-12 bg-[#002b5c] text-white flex justify-between items-center shrink-0 print:bg-white print:text-[#002b5c] print:p-0 print:border-b-4 print:border-[#002b5c] print:pb-8">
               <div className="space-y-2">
                 <h1 className="hidden print:block text-2xl font-black uppercase tracking-widest text-[#002b5c] mb-2">{config.businessName}</h1>
                 <h3 className="text-[12px] font-black uppercase tracking-tight print:text-xl">{viewingRecord.title} - চুক্তিপত্র</h3>
                 <p className="text-[9px] font-bold text-amber-400 uppercase tracking-[0.3em] opacity-80 print:text-slate-500">চুক্তিনামা ও লেনদেনের পূর্ণাঙ্গ সারসংক্ষেপ</p>
               </div>
               <div className="flex gap-4 print:hidden">
                  <button onClick={() => handleCloudPrint(viewingRecord.id)} className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border border-white/10 flex items-center gap-3"><span>🖨️</span> ক্লাউড প্রিন্ট</button>
                  <button onClick={handleBrowserPrint} className="px-8 py-4 bg-white hover:bg-slate-50 text-[#002b5c] rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shadow-xl flex items-center gap-3"><span>📄</span> প্রিন্ট করুন</button>
                  <button onClick={() => setViewingRecord(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-[14px] transition-all">✕</button>
               </div>
               <div className="hidden print:block text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase">ID: {viewingRecord.id.split('-')[0]}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase">তারিখ: {new Date().toLocaleDateString('bn-BD')}</p>
               </div>
            </div>
            
            <div id="printable-area" className="flex-1 overflow-y-auto p-16 space-y-12 custom-scrollbar print:overflow-visible print:p-10">
              
              {/* Image Grid Layout Matching Screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 print:grid-cols-2 print:gap-16">
                
                {/* Left Column: People Details */}
                <div className="space-y-12">
                   {/* Owner Info Block */}
                   <div className="space-y-8">
                      <h5 className="text-[10px] font-black uppercase text-amber-600 tracking-[0.3em] border-b border-amber-500/10 pb-4 print:text-xs">জমির মালিকের তথ্য</h5>
                      <div className="space-y-5">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">নাম:</span>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{viewingRecord.ownerName}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">মোবাইল:</span>
                            <span className="text-[10px] font-black text-amber-600">{viewingRecord.mobile}</span>
                         </div>
                         <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 print:bg-[#f8fafc] print:border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">জমির ঠিকানা</span>
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 italic">{viewingRecord.location || 'Nolobari'}</span>
                         </div>
                      </div>
                   </div>

                   {/* Contractor Info Block */}
                   <div className="space-y-8">
                      <h5 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] border-b border-indigo-500/10 pb-4 print:text-xs">চুক্তিধরের তথ্য (গ্রহীতা)</h5>
                      <div className="space-y-5">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">নাম:</span>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{viewingRecord.contractorName || 'ROBIL'}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">মোবাইল:</span>
                            <span className="text-[10px] font-black text-indigo-600">{viewingRecord.contractorMobile || '014717980777'}</span>
                         </div>
                         <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-[2rem] border border-indigo-100/50 dark:border-indigo-900/10 print:bg-[#f0f4ff] print:border-indigo-50">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">চুক্তিধরের ঠিকানা</span>
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 italic uppercase">{viewingRecord.contractorAddress || 'NOLBARI'}</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Right Column: Agreement Summary */}
                <div className="space-y-12">
                   {/* Agreement Details Table Style */}
                   <div className="space-y-8">
                      <h5 className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.3em] border-b border-emerald-500/10 pb-4 print:text-xs">চুক্তিনামা ও বিনিয়োগ</h5>
                      <div className="space-y-5">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">জমির পরিমাণ:</span>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{viewingRecord.area} শতক</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">বিনিয়োগ (Security):</span>
                            <span className="text-[10px] font-black text-indigo-600 uppercase">{viewingRecord.amount.toLocaleString()} ৳</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">নির্ধারিত কিস্তি:</span>
                            <span className="text-[10px] font-black text-emerald-600 uppercase">{viewingRecord.collectionAmount.toLocaleString()} ৳</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">নিবন্ধনের তারিখ:</span>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{new Date(viewingRecord.startDate).toLocaleDateString('bn-BD', {day:'numeric', month:'long', year:'numeric'})}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-400">মোট মেয়াদ:</span>
                            <span className="text-[10px] font-black text-emerald-600 uppercase">{viewingRecord.duration}</span>
                         </div>
                         
                         {/* Status Badge */}
                         <div className="p-4 rounded-2xl bg-[#eff6ff] dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 flex justify-between items-center print:bg-[#eff6ff] print:border-indigo-100">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">চুক্তির বর্তমান অবস্থা:</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${getExpiryInfo(viewingRecord).expired ? 'text-rose-500' : 'text-emerald-500'}`}>
                               {getExpiryInfo(viewingRecord).expired ? 'মেয়াদ উত্তীর্ণ' : 'সচল (ACTIVE)'}
                            </span>
                         </div>
                      </div>
                   </div>

                   {/* Large Stat Boxes Grid */}
                   <div className="grid grid-cols-2 gap-6 print:grid-cols-2">
                      <div className="p-10 rounded-[2.5rem] bg-[#f8fafc] dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 text-center space-y-3 print:bg-[#f8fafc] print:border-2 print:border-slate-100">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">মোট বিনিয়োগ</p>
                         <p className="text-[12px] font-black text-[#002b5c] dark:text-white">{viewingRecord.amount.toLocaleString()} ৳</p>
                      </div>
                      <div className="p-10 rounded-[2.5rem] bg-[#f0fdf4] dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/10 text-center space-y-3 print:bg-[#f0fdf4] print:border-2 print:border-emerald-100">
                         <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">মোট আদায়</p>
                         <p className="text-[12px] font-black text-emerald-600">{(viewingRecord.collections || []).reduce((s,c) => s+c.amount, 0).toLocaleString()} ৳</p>
                      </div>
                   </div>
                </div>

              </div>

              {/* Transaction Ledger Section */}
              <div className="pt-20 border-t border-slate-100 dark:border-slate-800 space-y-10 print:pt-10 print:border-t-2">
                 <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] flex justify-between items-center print:text-slate-600">
                    <span>লেনদেনের পূর্ণাঙ্গ ইতিহাস (PAYMENT HISTORY)</span>
                    <span className="text-[9px] opacity-60">Total Logs: {(viewingRecord.collections || []).length}</span>
                 </h5>
                 <div className="space-y-4 print:space-y-3">
                    {(viewingRecord.collections || []).length === 0 ? (
                       <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/20 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">এখনো কোনো লেনদেন রেকর্ড করা হয়নি</p>
                       </div>
                    ) : (
                       viewingRecord.collections.slice().reverse().map((c, idx) => (
                          <div key={idx} className="flex justify-between items-center p-8 rounded-[1.5rem] border-2 border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm print:p-6 print:rounded-2xl print:border print:border-slate-100 print:shadow-none print:break-inside-avoid">
                             <div className="flex items-center gap-8 print:gap-6">
                                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-[9px] font-black text-slate-400 uppercase leading-none print:w-12 print:h-12">
                                   <span className="text-[11px]">{new Date(c.date).getDate()}</span>
                                   <span className="mt-1.5">{new Date(c.date).toLocaleDateString('bn-BD', {month: 'short'})}</span>
                                </div>
                                <div>
                                   <p className="font-black text-[10px] uppercase text-slate-800 dark:text-slate-100">{new Date(c.date).toLocaleDateString('bn-BD', {year:'numeric', month:'long', day:'numeric'})}</p>
                                   <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-wide italic">{c.note || 'নিয়মিত কিস্তি আদায়'}</p>
                                </div>
                             </div>
                             <div className="text-right">
                               <p className="text-[12px] font-black text-emerald-600 tracking-tight">+{c.amount.toLocaleString()} ৳</p>
                               <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter print:text-slate-400">VERIFIED PAYMENT</span>
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              {/* Signature Section for Print */}
              <div className="hidden print:grid grid-cols-2 gap-40 mt-40 border-t-2 border-slate-100 pt-20">
                 <div className="text-center space-y-5">
                    <div className="h-px bg-slate-300 w-full mb-3"></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">জমির মালিকের স্বাক্ষর</p>
                    <p className="text-[9px] font-bold text-slate-400">({viewingRecord.ownerName})</p>
                 </div>
                 <div className="text-center space-y-5">
                    <div className="h-px bg-slate-300 w-full mb-3"></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">চুক্তিধরের স্বাক্ষর</p>
                    <p className="text-[9px] font-bold text-slate-400">({viewingRecord.contractorName})</p>
                 </div>
              </div>

              <div className="hidden print:block text-center mt-32 opacity-20">
                 <p className="text-[9px] font-black uppercase tracking-[0.6em]">{config.businessName} - DIGITAL RECORDS</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {isFormOpen && <RecordForm onSave={handleSaveRecord} onCancel={() => { setIsFormOpen(false); setEditingRecord(null); }} initialData={editingRecord} profitPercentage={config.profitPercentage} theme={config.theme} />}
      {collectingFor && <CollectionForm record={collectingFor} onSave={handleSaveCollection} onCancel={() => setCollectingFor(null)} theme={config.theme} />}

      <style>{`
        @keyframes progress { from { width: 100%; } to { width: 0%; } }
        @media print {
          @page { size: A4; margin: 1cm; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-hidden, aside, main, .fixed.inset-0:not(.print\:bg-white) { display: none !important; }
          .fixed.inset-0.print\:bg-white { 
            position: relative !important; inset: auto !important; display: block !important; 
            background: white !important; backdrop-filter: none !important; z-index: auto !important; padding: 0 !important;
          }
          #printable-area { display: block !important; visibility: visible !important; overflow: visible !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        * { font-size: 9px !important; }
      `}</style>
    </div>
  );
};

export default App;
