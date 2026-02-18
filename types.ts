
export interface CollectionEntry {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface LandRecord {
  id: string;
  title: string;
  area: number; // শতাংশ
  location: string; // জমির ঠিকানা
  amount: number; // বিনিয়োগকৃত টাকা (Security Amount)
  ownerName: string; // জমির মালিকের নাম
  mobile: string; // মালিকের মোবাইল নাম্বার
  duration: string; // মেয়াদ
  contractorName: string; // চুক্তিধরের নাম
  contractorMobile: string; // চুক্তিধরের মোবাইল
  contractorAddress: string; // চুক্তিধরের ঠিকানা
  collectionAmount: number; // নিয়মিত কালেকশন এর টাকা (Profit/Rent)
  reference?: string; // রেফারেন্স
  startDate: string;
  notes?: string;
  collections: CollectionEntry[]; // টাকা সংগ্রহের ইতিহাস
}

export interface AppConfig {
  businessName: string;
  profitPercentage: number;
  warningDays: number;
  currency: string;
  theme: 'light' | 'dark';
  googleSheetUrl?: string; // Google Apps Script Web App URL
  spreadsheetUrl?: string; // Actual Google Sheet file URL
  autoSync: boolean; // Automatic sync on data changes
  restrictCollectionToExpired: boolean; // New setting: Only allow collection for expired records
}

export interface FinancialStats {
  totalInvestment: number;
  totalCollected: number;
  activeContracts: number;
  pendingCollections: number;
}
