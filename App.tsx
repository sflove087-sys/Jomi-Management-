
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
      if (result.status === "success") {
        const newRecords = result.records || [];
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
      const matchesSearch = r.title.toLowerCase().includes(search) || r.ownerName.toLowerCase().includes(search) || r.mobile.includes(search) || (r.contractorName && r.contractorName.toLowerCase().includes(search));
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' && !expired) || (statusFilter === 'EXPIRED' && expired);
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  return (
    <div className={`min-h-screen transition-all ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[6000] flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white font-black uppercase tracking-widest">লোড হচ্ছে...</p>
        </div>
      )}

      {isSyncing && !isLoading && (
        <div className="fixed top-2 right-2 z-[4000] bg-emerald-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg animate-pulse">
           🔄 সিঙ্ক...
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[6000] flex items-center justify-center p-4">
          <div className={`w-full max-w-[280px] rounded-2xl p-6 shadow-2xl ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <h3 className="text-[11px] font-black uppercase mb-3 text-rose-500">মুছে ফেলুন</h3>
            <p className="opacity-70 mb-6 text-[9px] font-bold">আপনি কি নিশ্চিত যে <b>"{confirmDelete.title}"</b> চিরতরে মুছবেন?</p>
            <div className="flex gap-3">
               <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 rounded-lg font-black uppercase">না</button>
               <button onClick={handleDeleteRecord} className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg font-black uppercase">মুছুন</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen no-print">
        <aside className={`w-full lg:w-48 p-5 sticky top-0 h-auto lg:h-screen flex flex-col ${isDark ? 'bg-slate-900 border-r border-slate-800' : 'bg-[#002b5c]'} text-white`}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center text-[#002b5c] shadow-lg">🏠</div>
            <h1 className="font-black text-[10px] uppercase tracking-tighter leading-none">{config.businessName}</h1>
          </div>
          <nav className="flex-1 space-y-2">
            <button className="w-full text-left px-3 py-2.5 rounded-lg bg-white/10 font-black uppercase">ড্যাশবোর্ড</button>
            <button onClick={() => loadFromCloud()} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 font-black uppercase">রিফ্রেশ</button>
            <button onClick={() => setConfig({...config, theme: isDark ? 'light' : 'dark'})} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 font-black uppercase">থিম</button>
          </nav>
          <div className="mt-auto p-3 bg-white/5 rounded-lg border border-white/5 text-center">
            <p className="text-[8px] text-slate-400 font-black uppercase">আপডেট: {lastSync}</p>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar">
          <header className="flex justify-between items-center">
            <h2 className="text-[11px] font-black uppercase text-slate-500">ওভারভিউ</h2>
            <button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} className="bg-[#002b5c] text-white px-4 py-2.5 rounded-lg font-black uppercase tracking-widest shadow-xl">
              + নতুন রেকর্ড
            </button>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="বিনিয়োগ" value={`${stats.investment.toLocaleString()} ৳`} icon="💰" color="bg-indigo-600" theme={config.theme} />
            <StatCard label="আদায়কৃত" value={`${stats.collected.toLocaleString()} ৳`} icon="📈" color="bg-emerald-600" theme={config.theme} />
            <StatCard label="সচল" value={stats.active} icon="✅" color="bg-amber-500" theme={config.theme} />
            <StatCard label="মোট" value={stats.total} icon="📄" color="bg-rose-500" theme={config.theme} />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
            <input type="text" placeholder="খুঁজুন..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 px-4 py-2 rounded-lg border dark:bg-slate-950 dark:border-slate-800 outline-none font-black uppercase tracking-tighter" />
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
              {['ALL', 'ACTIVE', 'EXPIRED'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-4 py-1.5 rounded-md text-[8px] font-black uppercase ${statusFilter === s ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500'}`}>
                  {s === 'ALL' ? 'সকল' : s === 'ACTIVE' ? 'সচল' : 'শেষ'}
                </button>
              ))}
            </div>
          </div>

          {/* MINI CARD SYSTEM UPDATED */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredRecords.map(r => {
              const { expired } = getExpiryInfo(r);
              return (
                <div key={r.id} className={`group flex flex-col bg-white dark:bg-slate-900 rounded-xl border-2 p-3.5 transition-all hover:shadow-lg ${isDark ? 'border-slate-800' : 'border-slate-100'} ${expired ? 'opacity-70 grayscale' : ''}`}>
                   <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${expired ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                        <h4 className="font-black text-[9px] uppercase tracking-tighter truncate max-w-[100px]">{r.title}</h4>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewingRecord(r)} className="text-indigo-600 hover:scale-110 transition-transform">👁️</button>
                        <button onClick={() => setConfirmDelete({ id: r.id, title: r.title })} className="text-rose-600 hover:scale-110 transition-transform">🗑️</button>
                      </div>
                   </div>
                   
                   <div className="space-y-1 mt-1">
                      <div className="flex justify-between items-center text-[8px] font-bold text-slate-400">
                        <span>মালিক:</span>
                        <span className="text-slate-900 dark:text-slate-200 uppercase truncate max-w-[80px] text-right">{r.ownerName}</span>
                      </div>
                      <div className="flex justify-between items-center text-[8px] font-bold text-slate-400">
                        <span>চুক্তিধর:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 uppercase truncate max-w-[80px] text-right">{r.contractorName}</span>
                      </div>
                   </div>

                   <div className="h-px bg-slate-50 dark:bg-slate-800/50 my-2.5"></div>
                   
                   <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-400 uppercase">বিনিয়োগ</span>
                        <p className="text-[9px] font-black text-indigo-600">{r.amount.toLocaleString()}৳</p>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[7px] font-black text-emerald-600 uppercase">কিস্তি</span>
                        <p className="text-[9px] font-black text-emerald-600">{(r.collectionAmount || 0).toLocaleString()}৳</p>
                      </div>
                   </div>

                   <button onClick={() => setCollectingFor(r)} className="mt-3.5 w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all">আদায় করুন</button>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* VIEW CARD (PROFILE VIEW) */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[5000] flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className={`w-full max-w-[420px] rounded-2xl overflow-hidden shadow-2xl flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
             <div className="p-6 bg-[#002b5c] text-white flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-4xl">📄</div>
                <div className="relative z-10">
                   <h3 className="font-black text-[10px] uppercase tracking-widest leading-none">{viewingRecord.title}</h3>
                   <p className="text-[8px] font-black text-amber-400 tracking-[0.2em] uppercase mt-1.5 opacity-80">ID: {viewingRecord.id.slice(0,8)}</p>
                </div>
                <button onClick={() => setViewingRecord(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-rose-500 transition-all text-[12px] relative z-10 font-black">✕</button>
             </div>

             <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div className="space-y-1">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">জমির মালিক</span>
                         <p className="font-black text-[9px] uppercase leading-tight">{viewingRecord.ownerName}</p>
                      </div>
                      <div className="space-y-1">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">মালিকের মোবাইল</span>
                         <p className="font-black text-[9px] text-indigo-600 leading-tight">{viewingRecord.mobile}</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="space-y-1">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">চুক্তিধরের নাম</span>
                         <p className="font-black text-[9px] uppercase leading-tight text-indigo-500">{viewingRecord.contractorName}</p>
                      </div>
                      <div className="space-y-1">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">শুরুর তারিখ</span>
                         <p className="font-black text-[9px] uppercase leading-tight">{new Date(viewingRecord.startDate).toLocaleDateString('bn-BD')}</p>
                      </div>
                   </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                   <div className="text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">নিরাপত্তা বিনিয়োগ</p>
                      <p className="text-[10px] font-black text-[#002b5c] dark:text-white uppercase">{viewingRecord.amount.toLocaleString()} ৳</p>
                   </div>
                   <div className="text-center">
                      <p className="text-[8px] font-black text-emerald-600 uppercase mb-1">নির্ধারিত কিস্তি</p>
                      <p className="text-[10px] font-black text-emerald-600 uppercase">{viewingRecord.collectionAmount.toLocaleString()} ৳</p>
                   </div>
                </div>

                <div className="space-y-3">
                   <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">পেমেন্ট ইতিহাস</h5>
                   <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                      {(viewingRecord.collections || []).length === 0 ? (
                        <p className="text-center py-4 text-slate-400 italic font-bold">কোনো পেমেন্ট নেই</p>
                      ) : (
                        viewingRecord.collections.slice().reverse().map((c, i) => (
                          <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                             <div className="space-y-0.5">
                                <p className="font-black text-[8px] uppercase">{new Date(c.date).toLocaleDateString('bn-BD')}</p>
                                <p className="text-[7px] text-slate-400 font-bold italic">{c.note || 'কিস্তি আদায়'}</p>
                             </div>
                             <p className="font-black text-[9px] text-emerald-600">+{c.amount.toLocaleString()}</p>
                          </div>
                        ))
                      )}
                   </div>
                </div>

                <div className="flex gap-3 pt-2">
                   <button onClick={() => { setEditingRecord(viewingRecord); setIsFormOpen(true); setViewingRecord(null); }} className="flex-1 py-3 bg-amber-500 text-white rounded-lg font-black uppercase tracking-widest">সংশোধন</button>
                   <button onClick={() => window.print()} className="flex-1 py-3 bg-[#002b5c] text-white rounded-lg font-black uppercase tracking-widest">প্রিন্ট</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* PRINT VIEW */}
      {viewingRecord && (
        <div className="hidden print:block p-10 space-y-10 bg-white text-black min-h-screen">
           <div className="border-b-4 border-black pb-5 mb-10 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-widest mb-1">{config.businessName}</h1>
                <p className="text-[10px] font-bold uppercase text-gray-500">জমি বন্ধক ও লেনদেনের পূর্ণাঙ্গ রেকর্ড</p>
              </div>
              <p className="text-[10px] font-black uppercase">মুদ্রণ তারিখ: {new Date().toLocaleDateString('bn-BD')}</p>
           </div>
           
           <div className="grid grid-cols-2 gap-10">
              <div className="space-y-5">
                 <h4 className="border-b-2 border-gray-300 pb-2 font-black uppercase text-[10px]">জমির মালিকের তথ্য</h4>
                 <div className="space-y-3">
                    <div className="flex justify-between"><span>শিরোনাম:</span> <span className="font-black">{viewingRecord.title}</span></div>
                    <div className="flex justify-between"><span>মালিকের নাম:</span> <span className="font-black">{viewingRecord.ownerName}</span></div>
                    <div className="flex justify-between"><span>মোবাইল:</span> <span className="font-black">{viewingRecord.mobile}</span></div>
                    <div className="flex flex-col gap-1 mt-2">
                       <span className="text-gray-400">ঠিকানা:</span>
                       <p className="italic font-bold">{viewingRecord.location}</p>
                    </div>
                 </div>
              </div>
              <div className="space-y-5">
                 <h4 className="border-b-2 border-gray-300 pb-2 font-black uppercase text-[10px]">চুক্তিধর ও লেনদেন তথ্য</h4>
                 <div className="space-y-3">
                    <div className="flex justify-between"><span>চুক্তিধরের নাম:</span> <span className="font-black text-indigo-600">{viewingRecord.contractorName}</span></div>
                    <div className="flex justify-between"><span>বিনিয়োগ (Security):</span> <span className="font-black">{viewingRecord.amount.toLocaleString()} ৳</span></div>
                    <div className="flex justify-between"><span>নির্ধারিত কিস্তি:</span> <span className="font-black">{viewingRecord.collectionAmount.toLocaleString()} ৳</span></div>
                    <div className="flex justify-between"><span>মেয়াদকাল:</span> <span className="font-black">{viewingRecord.duration}</span></div>
                    <div className="flex justify-between"><span>নিবন্ধনের তারিখ:</span> <span className="font-black">{new Date(viewingRecord.startDate).toLocaleDateString('bn-BD')}</span></div>
                 </div>
              </div>
           </div>

           <div className="mt-10">
              <h4 className="border-b-2 border-gray-300 pb-2 font-black uppercase mb-5 text-center text-[10px]">লেনদেনের ইতিহাস (Payment Ledger)</h4>
              <table className="w-full text-left border-collapse border border-gray-400">
                 <thead>
                    <tr className="bg-gray-100 uppercase text-[9px] font-black">
                       <th className="p-3 border border-gray-400">ক্রমিক</th>
                       <th className="p-3 border border-gray-400">তারিখ</th>
                       <th className="p-3 border border-gray-400">টাকার পরিমাণ</th>
                       <th className="p-3 border border-gray-400">নোট / মন্তব্য</th>
                    </tr>
                 </thead>
                 <tbody className="text-[9px]">
                    {(viewingRecord.collections || []).map((c, i) => (
                      <tr key={i}>
                         <td className="p-3 border border-gray-400">{i+1}</td>
                         <td className="p-3 border border-gray-400">{new Date(c.date).toLocaleDateString('bn-BD')}</td>
                         <td className="p-3 border border-gray-400 font-black">{c.amount.toLocaleString()} ৳</td>
                         <td className="p-3 border border-gray-400">{c.note || '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-black">
                       <td colSpan={2} className="p-3 border border-gray-400 text-right uppercase">সর্বমোট আদায়কৃত:</td>
                       <td colSpan={2} className="p-3 border border-gray-400 text-emerald-600">{(viewingRecord.collections || []).reduce((s,c)=>s+c.amount,0).toLocaleString()} ৳</td>
                    </tr>
                 </tbody>
              </table>
           </div>

           <div className="mt-40 grid grid-cols-2 gap-40">
              <div className="text-center"><div className="border-t-2 border-gray-400 pt-3 uppercase font-black text-[9px]">জমির মালিকের স্বাক্ষর</div></div>
              <div className="text-center"><div className="border-t-2 border-gray-400 pt-3 uppercase font-black text-[9px]">চুক্তিধরের স্বাক্ষর</div></div>
           </div>
        </div>
      )}

      {isFormOpen && <RecordForm onSave={handleSaveRecord} onCancel={() => { setIsFormOpen(false); setEditingRecord(null); }} initialData={editingRecord} profitPercentage={config.profitPercentage} theme={config.theme} />}
      {collectingFor && <CollectionForm record={collectingFor} onSave={handleSaveCollection} onCancel={() => setCollectingFor(null)} theme={config.theme} />}

    </div>
  );
};

export default App;
