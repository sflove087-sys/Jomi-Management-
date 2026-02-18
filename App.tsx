
import React, { useState, useEffect, useMemo } from 'react';
import { LandRecord, CollectionEntry, AppConfig } from './types';
import StatCard from './components/StatCard';
import RecordForm from './components/RecordForm';
import CollectionForm from './components/CollectionForm';

// Fallback for crypto.randomUUID for non-secure contexts
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
        spreadsheetUrl: '',
        autoSync: true,
        restrictCollectionToExpired: false
      };
    } catch (e) {
      return {
        businessName: 'জমি বন্ধক ম্যানেজার',
        profitPercentage: 9,
        warningDays: 15,
        currency: '৳',
        theme: 'light',
        autoSync: true,
        restrictCollectionToExpired: false
      };
    }
  });

  const [records, setRecords] = useState<LandRecord[]>(() => {
    try {
      const saved = localStorage.getItem('jomi_records_v4');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
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
      const newRecord = { ...recordData, id: generateId(), collections: [] };
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
    const newEntries = entries.map(e => ({ id: generateId(), ...e }));
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
      const matchesSearch = r.title.toLowerCase().includes(search) || r.ownerName.toLowerCase().includes(search) || r.mobile.includes(search) || (r.contractorName && r.contractorName.toLowerCase().includes(search));
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
      
      {/* Sync Notification */}
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

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[4000] flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
          <div className={`w-full max-w-sm rounded-[3rem] p-10 border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
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

      {notification && (
        <div className={`fixed top-6 right-6 z-[2500] px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-500 flex items-center gap-4 font-black text-[9px] uppercase tracking-widest ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.message}
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-indigo-950/80 backdrop-blur-xl z-[3000] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-20 h-20 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white font-black text-[9px] uppercase mt-4">{loadingMessage}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen print:hidden">
        <aside className={`w-full lg:w-64 p-6 sticky top-0 h-auto lg:h-screen flex flex-col ${isDark ? 'bg-slate-900 border-r border-slate-800' : 'bg-[#002b5c] text-white shadow-2xl'}`}>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-[#002b5c]">
              <span className="text-[14px]">🏠</span>
            </div>
            <h1 className="text-[10px] font-black uppercase tracking-tighter">{config.businessName}</h1>
          </div>
          <div className="flex-1 space-y-3">
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-[9px] uppercase bg-amber-400 text-[#002b5c] transition-all hover:translate-x-1">ড্যাশবোর্ড</button>
            <button onClick={() => loadFromCloud()} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-[9px] uppercase text-slate-300 hover:bg-white/10 transition-all">রিফ্রেশ ডাটা</button>
          </div>
          <div className="mt-auto p-5 rounded-3xl bg-white/5 border border-white/5 text-center">
             <p className="text-[8px] text-slate-400 font-bold">আপডেট: {lastSync}</p>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-10 space-y-10 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-black text-[#002b5c] dark:text-white uppercase">ড্যাশবোর্ড</h2>
            <div className="flex gap-4">
              <button onClick={() => setConfig({...config, theme: isDark ? 'light' : 'dark'})} className={`w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg ${isDark ? 'bg-slate-800 text-amber-400' : 'bg-white text-slate-600'}`}>{isDark ? '🌞' : '🌙'}</button>
              <button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} className="bg-indigo-900 dark:bg-amber-400 dark:text-[#002b5c] text-white px-8 py-4 rounded-2xl font-black text-[9px] uppercase shadow-2xl">নতুন চুক্তি +</button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="মোট বিনিয়োগ" value={`${stats.investment.toLocaleString()} ৳`} icon="💰" color="bg-indigo-600" theme={config.theme} />
            <StatCard label="মোট আদায়" value={`${stats.collected.toLocaleString()} ৳`} icon="📈" color="bg-emerald-600" theme={config.theme} />
            <StatCard label="সচল চুক্তি" value={stats.active} icon="✅" color="bg-[#002b5c]" theme={config.theme} />
            <StatCard label="মোট চুক্তি" value={stats.total} icon="📄" color="bg-rose-500" theme={config.theme} />
          </div>

          <div className="flex flex-col xl:flex-row gap-6 justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800">
             <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl">
                {['ALL', 'ACTIVE', 'EXPIRED'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-8 py-4 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === s ? 'bg-[#002b5c] text-white' : 'text-slate-500'}`}>{s === 'ALL' ? 'সকল' : s === 'ACTIVE' ? 'সচল' : 'মেয়াদ উত্তীর্ণ'}</button>
                ))}
             </div>
             <input type="text" placeholder="খুঁজুন..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full xl:w-96 py-5 pl-6 pr-6 rounded-2xl border outline-none font-black text-[9px] ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
            {filteredRecords.map(r => {
              const { expired } = getExpiryInfo(r);
              return (
                <div key={r.id} className={`flex flex-col rounded-[3rem] border-2 overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} ${expired ? 'opacity-80' : ''}`}>
                  <div className="p-7 flex justify-between items-center border-b-2">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#002b5c] text-white font-black">{getInitials(r.ownerName)}</div>
                      <h4 className="text-[10px] font-black uppercase tracking-tight">{r.title}</h4>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => setViewingRecord(r)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">👁️</button>
                       <button onClick={() => handleCloudPrint(r.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">🖨️</button>
                    </div>
                  </div>
                  <div className="p-8 space-y-4">
                    <p className="text-[10px] font-black uppercase">{r.ownerName}</p>
                    <p className="text-[9px] font-bold text-slate-500">বিনিয়োগ: {r.amount.toLocaleString()} ৳</p>
                  </div>
                  <div className="p-8 pt-0">
                    <button onClick={() => setCollectingFor(r)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase">কিস্তি আদায়</button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* View Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-2xl z-[2000] flex items-center justify-center p-4 print:bg-white print:p-0">
          <div className={`w-full max-w-5xl rounded-[4rem] overflow-hidden border flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <div className="p-12 bg-[#002b5c] text-white flex justify-between items-center print:bg-white print:text-[#002b5c] print:border-b-4 print:pb-8">
               <div>
                 <h1 className="hidden print:block text-2xl font-black uppercase text-[#002b5c]">{config.businessName}</h1>
                 <h3 className="text-[12px] font-black uppercase print:text-xl">{viewingRecord.title} - চুক্তিপত্র</h3>
               </div>
               <div className="flex gap-4 print:hidden">
                  <button onClick={handleBrowserPrint} className="px-8 py-4 bg-white text-[#002b5c] rounded-2xl font-black text-[9px] uppercase">প্রিন্ট</button>
                  <button onClick={() => setViewingRecord(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-500 text-white">✕</button>
               </div>
            </div>
            
            <div id="printable-area" className="flex-1 overflow-y-auto p-16 space-y-12 custom-scrollbar print:overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 print:grid-cols-2">
                <div className="space-y-12">
                   <div className="space-y-8">
                      <h5 className="text-[10px] font-black uppercase text-amber-600 border-b pb-4">জমির মালিকের তথ্য</h5>
                      <div className="space-y-5">
                         <div className="flex justify-between"><span className="font-black text-slate-400">নাম:</span><span className="font-black uppercase">{viewingRecord.ownerName}</span></div>
                         <div className="flex justify-between"><span className="font-black text-slate-400">মোবাইল:</span><span className="font-black text-amber-600">{viewingRecord.mobile}</span></div>
                         <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border">
                            <span className="text-[9px] font-black text-slate-400 uppercase mb-2 block">ঠিকানা</span>
                            <span className="text-[10px] font-medium italic">{viewingRecord.location || 'Nolobari'}</span>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-8">
                      <h5 className="text-[10px] font-black uppercase text-indigo-600 border-b pb-4">চুক্তিধরের তথ্য</h5>
                      <div className="space-y-5">
                         <div className="flex justify-between"><span className="font-black text-slate-400">নাম:</span><span className="font-black uppercase">{viewingRecord.contractorName}</span></div>
                         <div className="flex justify-between"><span className="font-black text-slate-400">মোবাইল:</span><span className="font-black text-indigo-600">{viewingRecord.contractorMobile}</span></div>
                         <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-[2rem] border">
                            <span className="text-[9px] font-black text-indigo-400 uppercase mb-2 block">ঠিকানা</span>
                            <span className="text-[10px] font-medium italic">{viewingRecord.contractorAddress || 'Nolobari'}</span>
                         </div>
                      </div>
                   </div>
                </div>
                <div className="space-y-12">
                   <div className="space-y-8">
                      <h5 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-4">বিনিয়োগ ও আদায়</h5>
                      <div className="space-y-5">
                         <div className="flex justify-between"><span className="font-black text-slate-400">জমির পরিমাণ:</span><span className="font-black uppercase">{viewingRecord.area} শতক</span></div>
                         <div className="flex justify-between"><span className="font-black text-slate-400">বিনিয়োগ:</span><span className="font-black text-indigo-600">{viewingRecord.amount.toLocaleString()} ৳</span></div>
                         <div className="flex justify-between"><span className="font-black text-slate-400">তারিখ:</span><span className="font-black uppercase">{new Date(viewingRecord.startDate).toLocaleDateString('bn-BD')}</span></div>
                         <div className="p-4 rounded-2xl bg-[#eff6ff] border flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase">অবস্থা:</span>
                            <span className={`text-[10px] font-black uppercase ${getExpiryInfo(viewingRecord).expired ? 'text-rose-500' : 'text-emerald-500'}`}>
                               {getExpiryInfo(viewingRecord).expired ? 'মেয়াদ উত্তীর্ণ' : 'সচল'}
                            </span>
                         </div>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-6">
                      <div className="p-10 rounded-[2.5rem] bg-[#f8fafc] border text-center space-y-3">
                         <p className="text-[9px] font-black text-slate-400 uppercase">মোট বিনিয়োগ</p>
                         <p className="text-[12px] font-black text-[#002b5c]">{viewingRecord.amount.toLocaleString()} ৳</p>
                      </div>
                      <div className="p-10 rounded-[2.5rem] bg-[#f0fdf4] border text-center space-y-3">
                         <p className="text-[9px] font-black text-emerald-600 uppercase">মোট আদায়</p>
                         <p className="text-[12px] font-black text-emerald-600">{(viewingRecord.collections || []).reduce((s,c) => s+c.amount, 0).toLocaleString()} ৳</p>
                      </div>
                   </div>
                </div>
              </div>
              <div className="pt-20 border-t space-y-10 print:pt-10">
                 <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] flex justify-between">লেনদেনের ইতিহাস</h5>
                 <div className="space-y-4">
                    {viewingRecord.collections.map((c, idx) => (
                      <div key={idx} className="flex justify-between items-center p-8 rounded-[1.5rem] border bg-white print:p-4 print:break-inside-avoid">
                         <div>
                            <p className="font-black text-[10px] uppercase text-slate-800">{new Date(c.date).toLocaleDateString('bn-BD')}</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-1 italic">{c.note || 'কিস্তি আদায়'}</p>
                         </div>
                         <p className="text-[12px] font-black text-emerald-600">+{c.amount.toLocaleString()} ৳</p>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="hidden print:grid grid-cols-2 gap-40 mt-40 border-t pt-20">
                 <div className="text-center space-y-5 border-t pt-4"><p className="text-[10px] font-black uppercase text-slate-600">মালিকের স্বাক্ষর</p></div>
                 <div className="text-center space-y-5 border-t pt-4"><p className="text-[10px] font-black uppercase text-slate-600">চুক্তিধরের স্বাক্ষর</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && <RecordForm onSave={handleSaveRecord} onCancel={() => { setIsFormOpen(false); setEditingRecord(null); }} initialData={editingRecord} profitPercentage={config.profitPercentage} theme={config.theme} />}
      {collectingFor && <CollectionForm record={collectingFor} onSave={handleSaveCollection} onCancel={() => setCollectingFor(null)} theme={config.theme} />}

      <style>{`
        @media print {
          @page { size: A4; margin: 1cm; }
          body { background: white !important; }
          .print-hidden { display: none !important; }
          #printable-area { visibility: visible !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        * { font-size: 9px !important; }
      `}</style>
    </div>
  );
};

export default App;
