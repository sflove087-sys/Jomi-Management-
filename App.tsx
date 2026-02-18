
import React, { useState, useEffect, useMemo } from 'react';
import { LandRecord, CollectionEntry, AppConfig } from './types';
import StatCard from './components/StatCard';
import RecordForm from './components/RecordForm';
import CollectionForm from './components/CollectionForm';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('jomi_config_v2');
      return saved ? JSON.parse(saved) : {
        businessName: 'জমি বন্ধক ম্যানেজার',
        profitPercentage: 9,
        warningDays: 15,
        currency: '৳',
        theme: 'light',
        googleSheetUrl: 'https://script.google.com/macros/s/AKfycbxK4JSotFBwBWxoHJECh6Y6OROSrTqyp-QqFwiNVmwbenV0ouLgQKZcV-D7x6NLVcvs/exec',
        autoSync: true,
        restrictCollectionToExpired: false
      };
    } catch (e) {
      return { businessName: 'জমি বন্ধক ম্যানেজার', profitPercentage: 9, theme: 'light', autoSync: true, restrictCollectionToExpired: false };
    }
  });

  const [records, setRecords] = useState<LandRecord[]>(() => {
    try {
      const saved = localStorage.getItem('jomi_records_v4');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [lastSync, setLastSync] = useState<string>(localStorage.getItem('jomi_last_sync') || 'কখনো নয়');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandRecord | null>(null);
  const [collectingFor, setCollectingFor] = useState<LandRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<LandRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('ডাটা লোড হচ্ছে...');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, title: string } | null>(null);
  const isDark = config.theme === 'dark';

  useEffect(() => {
    localStorage.setItem('jomi_records_v4', JSON.stringify(records));
    localStorage.setItem('jomi_config_v2', JSON.stringify(config));
    document.title = config.businessName;
  }, [records, config]);

  // 5 Second Auto-Sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (config.googleSheetUrl && !isLoading && !isSyncing) {
        loadFromCloud(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [config.googleSheetUrl, isLoading, isSyncing]);

  const loadFromCloud = async (isSilent = false) => {
    if (!config.googleSheetUrl) return;
    if (!isSilent) setIsLoading(true);
    else setIsSyncing(true);

    try {
      const response = await fetch(`${config.googleSheetUrl}?t=${Date.now()}`);
      const result = await response.json();
      if (result.status === 'success') {
        const newRecords = result.records || [];
        // Only update if data actually changed to avoid re-renders
        if (JSON.stringify(newRecords) !== JSON.stringify(records)) {
          setRecords(newRecords);
        }
        const time = new Date().toLocaleTimeString('bn-BD');
        setLastSync(time);
        localStorage.setItem('jomi_last_sync', time);
      }
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      if (!isSilent) setIsLoading(false);
      else setIsSyncing(false);
    }
  };

  const syncToCloud = async (action: string, data: any) => {
    if (!config.googleSheetUrl) return;
    setIsSyncing(true);
    try {
      await fetch(config.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action, ...data })
      });
      // After any manual action, pull the latest data
      setTimeout(() => loadFromCloud(true), 1000);
    } catch (e) {
      console.error("Post Sync Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveRecord = async (recordData: any) => {
    setIsLoading(true);
    setLoadingMessage('সংরক্ষণ হচ্ছে...');
    let updatedRecords: LandRecord[];
    if (recordData.id) {
      updatedRecords = records.map(r => r.id === recordData.id ? { ...r, ...recordData } : r);
      await syncToCloud('edit', { record: recordData });
    } else {
      const newRecord = { ...recordData, id: generateId(), collections: [] };
      updatedRecords = [...records, newRecord];
      await syncToCloud('add', { record: newRecord });
    }
    setRecords(updatedRecords);
    setIsFormOpen(false);
    setEditingRecord(null);
    setIsLoading(false);
  };

  const handleDeleteRecord = async () => {
    if (!confirmDelete) return;
    setIsLoading(true);
    setLoadingMessage('মুছে ফেলা হচ্ছে...');
    const idToDelete = confirmDelete.id;
    const updatedRecords = records.filter(r => r.id !== idToDelete);
    setRecords(updatedRecords);
    await syncToCloud('delete', { id: idToDelete });
    setConfirmDelete(null);
    setIsLoading(false);
  };

  const handleSaveCollection = async (entries: any[]) => {
    if (!collectingFor) return;
    setIsLoading(true);
    setLoadingMessage('কিস্তি জমা হচ্ছে...');
    const newEntries = entries.map(e => ({ id: generateId(), ...e }));
    const updatedRec = { ...collectingFor, collections: [...(collectingFor.collections || []), ...newEntries] };
    const updatedRecords = records.map(r => r.id === collectingFor.id ? updatedRec : r);
    setRecords(updatedRecords);
    await syncToCloud('edit', { record: updatedRec });
    setCollectingFor(null);
    setIsLoading(false);
  };

  const getExpiryInfo = (record: LandRecord) => {
    if (!record.startDate || !record.duration) return { expired: false };
    const expiry = new Date(record.startDate);
    const parts = record.duration.split(' ');
    const val = parseInt(parts[0]) || 0;
    const unit = parts[1];
    if (unit === 'বছর') expiry.setFullYear(expiry.getFullYear() + val);
    else if (unit === 'মাস') expiry.setMonth(expiry.getMonth() + val);
    else expiry.setDate(expiry.getDate() + val);
    return { expired: new Date() > expiry, date: expiry };
  };

  const stats = useMemo(() => ({
    investment: records.reduce((acc, r) => acc + Number(r.amount || 0), 0),
    collected: records.reduce((acc, r) => acc + (r.collections?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0), 0),
    active: records.filter(r => !getExpiryInfo(r).expired).length,
    total: records.length
  }), [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const search = searchTerm.toLowerCase();
      const { expired } = getExpiryInfo(r);
      const matchesSearch = r.title.toLowerCase().includes(search) || r.ownerName.toLowerCase().includes(search) || r.mobile.includes(search);
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' && !expired) || (statusFilter === 'EXPIRED' && expired);
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  return (
    <div className={`min-h-screen transition-all ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-6 text-white font-bold text-lg">{loadingMessage}</p>
        </div>
      )}

      {/* Sync Status Overlay */}
      {isSyncing && !isLoading && (
        <div className="fixed top-4 right-4 z-[4000] bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-pulse">
           🔄 ক্লাউড সিঙ্ক হচ্ছে...
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-8 shadow-2xl ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <h3 className="text-xl font-bold mb-4">চুক্তি মুছে ফেলুন</h3>
            <p className="opacity-70 mb-8">আপনি কি নিশ্চিত যে <b>"{confirmDelete.title}"</b> চুক্তিটি চিরতরে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা সম্ভব নয়।</p>
            <div className="flex gap-4">
               <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 rounded-xl font-bold">বাতিল</button>
               <button onClick={handleDeleteRecord} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold">মুছে ফেলুন</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen no-print">
        {/* Sidebar */}
        <aside className={`w-full lg:w-72 p-8 sticky top-0 h-auto lg:h-screen flex flex-col ${isDark ? 'bg-slate-900 border-r border-slate-800' : 'bg-indigo-950'} text-white`}>
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center text-indigo-950 text-2xl shadow-xl shadow-amber-400/20">🏠</div>
            <div>
              <h1 className="font-black text-xl leading-tight uppercase tracking-tighter">{config.businessName}</h1>
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-widest">Digital Ledger</span>
            </div>
          </div>
          <nav className="flex-1 space-y-3">
            <button className="w-full text-left px-5 py-4 rounded-2xl bg-white/10 font-black text-xs uppercase tracking-widest flex items-center gap-4">
              <span className="text-lg">📊</span> ড্যাশবোর্ড
            </button>
            <button onClick={() => loadFromCloud()} className="w-full text-left px-5 py-4 rounded-2xl hover:bg-white/5 font-bold text-xs uppercase tracking-widest flex items-center gap-4 transition-all">
              <span className="text-lg">🔄</span> ডাটা রিফ্রেশ
            </button>
            <button onClick={() => setConfig({...config, theme: isDark ? 'light' : 'dark'})} className="w-full text-left px-5 py-4 rounded-2xl hover:bg-white/5 font-bold text-xs uppercase tracking-widest flex items-center gap-4 transition-all">
              <span className="text-lg">{isDark ? '🌞' : '🌙'}</span> {isDark ? 'লাইট মোড' : 'ডার্ক মোড'}
            </button>
          </nav>
          <div className="mt-auto p-5 bg-white/5 rounded-2xl border border-white/5 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">শেষ আপডেট</p>
            <p className="text-xs font-black text-amber-400">{lastSync}</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-12 space-y-10 overflow-y-auto custom-scrollbar">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
               <h2 className="text-3xl font-black uppercase tracking-tight">ওভারভিউ</h2>
               <p className="text-slate-500 font-medium">আপনার সব বন্ধকী জমির হিসাব এখানে</p>
            </div>
            <button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all">
              + নতুন চুক্তি নিবন্ধন
            </button>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
            <StatCard label="মোট বিনিয়োগ" value={`${stats.investment.toLocaleString()} ৳`} icon="💰" color="bg-indigo-600" theme={config.theme} />
            <StatCard label="মোট আদায়" value={`${stats.collected.toLocaleString()} ৳`} icon="📈" color="bg-emerald-600" theme={config.theme} />
            <StatCard label="সচল চুক্তি" value={stats.active} icon="✅" color="bg-amber-500" theme={config.theme} />
            <StatCard label="মোট রেকর্ড" value={stats.total} icon="📄" color="bg-rose-500" theme={config.theme} />
          </div>

          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex-1 relative group">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 transition-all group-focus-within:text-indigo-600">🔍</span>
              <input type="text" placeholder="মালিক, টাইটেল বা মোবাইল দিয়ে খুঁজুন..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 rounded-2xl border dark:bg-slate-950 dark:border-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm" />
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl shrink-0 overflow-x-auto">
              {['ALL', 'ACTIVE', 'EXPIRED'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === s ? 'bg-white dark:bg-slate-800 shadow-md text-indigo-600' : 'text-slate-500'}`}>
                  {s === 'ALL' ? 'সকল' : s === 'ACTIVE' ? 'সচল' : 'মেয়াদ শেষ'}
                </button>
              ))}
            </div>
          </div>

          {/* Records Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 pb-20">
            {filteredRecords.map(r => {
              const { expired } = getExpiryInfo(r);
              const totalCol = (r.collections || []).reduce((s, c) => s + c.amount, 0);
              return (
                <div key={r.id} className={`group flex flex-col rounded-[3rem] border-2 transition-all hover:shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} ${expired ? 'grayscale-[0.4] opacity-80' : ''}`}>
                  <div className="p-8 flex justify-between items-center border-b-2 bg-slate-50/50 dark:bg-slate-950/20">
                    <div className="space-y-2">
                      <h4 className="font-black text-xl uppercase leading-none tracking-tight">{r.title}</h4>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest inline-block ${expired ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {expired ? 'মেয়াদ উত্তীর্ণ' : 'সচল চুক্তি'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setViewingRecord(r)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:bg-indigo-600 hover:text-white transition-all">👁️</button>
                      <button onClick={() => { setEditingRecord(r); setIsFormOpen(true); }} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:bg-amber-500 hover:text-white transition-all">✏️</button>
                      <button onClick={() => setConfirmDelete({ id: r.id, title: r.title })} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:bg-rose-600 hover:text-white transition-all">🗑️</button>
                    </div>
                  </div>
                  <div className="p-10 space-y-6 flex-1">
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">জমির মালিক</p>
                           <p className="font-black text-lg uppercase text-slate-800 dark:text-slate-100">{r.ownerName}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">জমির পরিমাণ</p>
                           <p className="font-black text-lg">{r.area} শতক</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">বিনিয়োগ</p>
                          <p className="font-black text-indigo-600 text-lg">{r.amount.toLocaleString()} ৳</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/10">
                          <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">মোট আদায়</p>
                          <p className="font-black text-emerald-600 text-lg">{totalCol.toLocaleString()} ৳</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-10 pt-0">
                    <button onClick={() => setCollectingFor(r)} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">কিস্তি আদায় করুন</button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Viewing Record - Full Profile & Print Ready */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[5000] flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto custom-scrollbar">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden print:rounded-none print:shadow-none print:max-w-none flex flex-col">
            
            <div className="p-10 bg-indigo-900 text-white flex justify-between items-center no-print sticky top-0 z-10">
              <div className="flex items-center gap-6">
                 <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center text-indigo-950 font-black">📄</div>
                 <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">চুক্তিপত্রের পূর্ণাঙ্গ প্রোফাইল</h3>
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest opacity-80">System Record ID: {viewingRecord.id}</p>
                 </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => window.print()} className="bg-white text-indigo-900 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2"><span>🖨️</span> প্রিন্ট রিপোর্ট</button>
                <button onClick={() => setViewingRecord(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-rose-500 transition-all">✕</button>
              </div>
            </div>

            <div className="p-12 lg:p-20 space-y-16 bg-white dark:bg-slate-900 text-slate-900 dark:text-white print:text-black">
              {/* Header for print only */}
              <div className="hidden print:flex justify-between items-start border-b-4 border-indigo-900 pb-10 mb-10">
                 <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-indigo-900 mb-2">{config.businessName}</h1>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">ডিজিটাল চুক্তিনামা ও লেনদেনের ইতিহাস</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-black uppercase text-slate-400 mb-1">তারিখ</p>
                    <p className="text-lg font-bold">{new Date().toLocaleDateString('bn-BD')}</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                {/* Left: Info Grid */}
                <div className="space-y-12">
                  <div className="space-y-8">
                    <h5 className="text-amber-600 font-black uppercase tracking-[0.3em] border-b-2 border-amber-100 pb-4 text-xs">জমির মালিকের তথ্য</h5>
                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">পূর্ণ নাম:</span> <span className="font-black uppercase text-lg">{viewingRecord.ownerName}</span></div>
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">মোবাইল:</span> <span className="font-black text-lg text-amber-600">{viewingRecord.mobile}</span></div>
                      <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-3">জমির পূর্ণ ঠিকানা</span>
                        <p className="italic font-bold text-lg leading-relaxed">{viewingRecord.location || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <h5 className="text-indigo-600 font-black uppercase tracking-[0.3em] border-b-2 border-indigo-100 pb-4 text-xs">চুক্তিধরের তথ্য (গ্রহীতা)</h5>
                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">চুক্তিধরের নাম:</span> <span className="font-black uppercase text-lg">{viewingRecord.contractorName}</span></div>
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">মোবাইল:</span> <span className="font-black text-lg text-indigo-600">{viewingRecord.contractorMobile}</span></div>
                      <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] border border-indigo-100/50 dark:border-indigo-900/10">
                        <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest block mb-3">চুক্তিধরের ঠিকানা</span>
                        <p className="italic font-bold text-lg leading-relaxed">{viewingRecord.contractorAddress || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Agreement Details Grid */}
                <div className="space-y-12">
                  <div className="space-y-8">
                    <h5 className="text-emerald-600 font-black uppercase tracking-[0.3em] border-b-2 border-emerald-100 pb-4 text-xs">চুক্তিনামা ও বিনিয়োগ</h5>
                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">জমির পরিমাণ:</span> <span className="font-black text-lg">{viewingRecord.area} শতক</span></div>
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">বিনিয়োগ (Security):</span> <span className="font-black text-lg text-indigo-600">{viewingRecord.amount.toLocaleString()} ৳</span></div>
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">নির্ধারিত কিস্তি:</span> <span className="font-black text-lg text-emerald-600">{viewingRecord.collectionAmount.toLocaleString()} ৳</span></div>
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">নিবন্ধনের তারিখ:</span> <span className="font-black text-lg">{new Date(viewingRecord.startDate).toLocaleDateString('bn-BD', {day:'numeric', month:'long', year:'numeric'})}</span></div>
                      <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2"><span className="text-slate-400 font-bold uppercase text-[10px]">মোট মেয়াদ:</span> <span className="font-black text-lg text-emerald-600">{viewingRecord.duration}</span></div>
                      <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-3xl flex justify-between items-center border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">চুক্তির বর্তমান অবস্থা:</span>
                        <span className={`font-black uppercase text-xs tracking-tighter ${getExpiryInfo(viewingRecord).expired ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {getExpiryInfo(viewingRecord).expired ? 'মেয়াদ উত্তীর্ণ (EXPIRED)' : 'সচল চুক্তি (ACTIVE)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="p-10 rounded-[3rem] bg-slate-50 dark:bg-slate-950/50 border-2 border-slate-100 dark:border-slate-800 text-center space-y-4">
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">মোট বিনিয়োগ</p>
                       <p className="text-2xl font-black text-indigo-900 dark:text-white">{viewingRecord.amount.toLocaleString()} ৳</p>
                    </div>
                    <div className="p-10 rounded-[3rem] bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-100/50 dark:border-emerald-900/10 text-center space-y-4">
                       <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">মোট আদায়কৃত</p>
                       <p className="text-2xl font-black text-emerald-600">{(viewingRecord.collections || []).reduce((s,c) => s+c.amount, 0).toLocaleString()} ৳</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="pt-16 border-t-2 border-slate-50 dark:border-slate-800 space-y-10">
                <h5 className="font-black text-slate-400 uppercase tracking-[0.4em] text-xs">লেনদেনের পূর্ণাঙ্গ ইতিহাস (Transaction Ledger)</h5>
                <div className="space-y-6">
                  {(viewingRecord.collections || []).length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/20 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-black uppercase tracking-widest">কোনো লেনদেন রেকর্ড করা হয়নি।</div>
                  ) : (
                    viewingRecord.collections.slice().reverse().map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-8 bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-3xl shadow-sm print:shadow-none print:border-slate-100">
                        <div className="flex items-center gap-10">
                           <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-[10px] font-black text-slate-400 uppercase leading-none">
                              <span className="text-lg text-slate-600 dark:text-slate-300">{new Date(c.date).getDate()}</span>
                              <span className="mt-1">{new Date(c.date).toLocaleDateString('bn-BD', {month: 'short'})}</span>
                           </div>
                           <div>
                             <p className="font-black text-lg uppercase">{new Date(c.date).toLocaleDateString('bn-BD', {day:'numeric', month:'long', year:'numeric'})}</p>
                             <p className="text-xs text-slate-400 font-bold italic mt-1">{c.note || 'নিয়মিত কিস্তি আদায়'}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-2xl font-black text-emerald-600 tracking-tight">+{c.amount.toLocaleString()} ৳</p>
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Verified Payment</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Print Only: Footer/Signatures */}
              <div className="hidden print:grid grid-cols-2 gap-40 mt-60 border-t-2 border-slate-100 pt-20">
                 <div className="text-center space-y-5">
                    <div className="h-px bg-slate-300 w-full mb-3"></div>
                    <p className="font-black uppercase tracking-[0.3em] text-slate-600 text-xs">জমির মালিকের স্বাক্ষর</p>
                    <p className="text-[10px] font-bold text-slate-400">({viewingRecord.ownerName})</p>
                 </div>
                 <div className="text-center space-y-5">
                    <div className="h-px bg-slate-300 w-full mb-3"></div>
                    <p className="font-black uppercase tracking-[0.3em] text-slate-600 text-xs">চুক্তিধরের স্বাক্ষর</p>
                    <p className="text-[10px] font-bold text-slate-400">({viewingRecord.contractorName})</p>
                 </div>
              </div>

              <div className="hidden print:block text-center mt-40 opacity-20">
                 <p className="text-[10px] font-black uppercase tracking-[0.8em]">{config.businessName} - Powered by Jomi Ledger System</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && <RecordForm onSave={handleSaveRecord} onCancel={() => { setIsFormOpen(false); setEditingRecord(null); }} initialData={editingRecord} profitPercentage={config.profitPercentage} theme={config.theme} />}
      {collectingFor && <CollectionForm record={collectingFor} onSave={handleSaveCollection} onCancel={() => setCollectingFor(null)} theme={config.theme} />}

    </div>
  );
};

export default App;
