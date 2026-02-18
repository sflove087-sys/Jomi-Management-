
/**
 * জমি বন্ধক ম্যানেজার - গুগল শিট ব্যাকএন্ড স্ক্রিপ্ট (সংস্করণ: ৫.২)
 * এই সংস্করণে চুক্তিধরের নাম, মোবাইল এবং ঠিকানা সাপোর্ট যোগ করা হয়েছে।
 */

var HEADERS = [
  "আইডি (ID)", 
  "চুক্তির শিরোনাম", 
  "মালিকের নাম", 
  "মালিকের মোবাইল", 
  "বিনিয়োগ (Security)", 
  "নির্ধারিত কিস্তি", 
  "মোট আদায়কৃত", 
  "শুরু", 
  "মেয়াদকাল", 
  "জমির পরিমাণ", 
  "জমির ঠিকানা", 
  "চুক্তিধরের নাম",
  "চুক্তিধরের মোবাইল",
  "চুক্তিধরের ঠিকানা",
  "নোট",
  "COLLECTIONS_JSON"
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏠 জমি ম্যানেজার')
      .addItem('শিট সেটআপ করুন', 'setupSheetStructure')
      .addSeparator()
      .addItem('নির্বাচিত চুক্তি মুছুন', 'deleteActiveRecord')
      .addItem('সব ডাটা মুছুন (রিসেট)', 'resetSheetData')
      .addToUi();
}

function deleteActiveRecord() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  
  if (sheet.getName() !== "চুক্তি_রেকর্ডস") {
    SpreadsheetApp.getUi().alert("অনুগ্রহ করে 'চুক্তি_রেকর্ডস' শিটে গিয়ে এই ফাংশনটি ব্যবহার করুন।");
    return;
  }
  
  var activeRow = sheet.getActiveCell().getRow();
  
  if (activeRow <= 1) {
    SpreadsheetApp.getUi().alert("হেডার রো (প্রথম লাইন) মুছে ফেলা সম্ভব নয়।");
    return;
  }
  
  var ui = SpreadsheetApp.getUi();
  var recordName = sheet.getRange(activeRow, 2).getValue();
  
  var response = ui.alert(
    'চুক্তি মুছে ফেলুন', 
    'আপনি কি নিশ্চিত যে "' + recordName + '" এর এই চুক্তিটি মুছে ফেলতে চান?', 
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    sheet.deleteRow(activeRow);
    ui.alert('সফলভাবে মুছে ফেলা হয়েছে।');
  }
}

function resetSheetData() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('সতর্কতা!', 'আপনি কি নিশ্চিত যে আপনি সব ডাটা মুছে ফেলতে চান?', ui.ButtonSet.YES_NO);
  if (response == ui.Button.YES) {
    setupSheetStructure();
  }
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("চুক্তি_রেকর্ডস") || setupSheetStructure();
    
    // Live Print Feature
    if (action === 'print' && e.parameter.id) {
      return renderPrintView(sheet, e.parameter.id);
    }

    var data = sheet.getDataRange().getValues();
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue; 

      var collections = [];
      try {
        var colJson = row[15]; // Index for COLLECTIONS_JSON
        if (colJson) collections = JSON.parse(colJson);
      } catch (err) { collections = []; }

      records.push({
        id: row[0].toString(),
        title: row[1].toString(),
        ownerName: row[2].toString(),
        mobile: row[3] ? row[3].toString().replace(/'/g, "") : "",
        amount: Number(row[4]) || 0,
        collectionAmount: Number(row[5]) || 0,
        startDate: row[7] instanceof Date ? row[7].toISOString().split('T')[0] : (row[7] || ""),
        duration: row[8].toString(),
        area: Number(row[9]) || 0,
        location: row[10].toString(),
        contractorName: row[11].toString(),
        contractorMobile: row[12].toString(),
        contractorAddress: row[13].toString(),
        notes: row[14].toString(),
        collections: collections
      });
    }
    return createJsonResponse({ status: "success", records: records });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("চুক্তি_রেকর্ডস") || setupSheetStructure();
    
    if (action === 'add') {
      return appendRecord(sheet, data.record);
    } else if (action === 'edit') {
      return updateRecord(sheet, data.record);
    } else if (action === 'delete') {
      return deleteRecord(sheet, data.id);
    } else if (action === 'sync') {
      return performSync(ss, data.records);
    }
    
    return createJsonResponse({ status: "error", message: "Invalid action" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function appendRecord(sheet, r) {
  var row = recordToRow(r);
  sheet.appendRow(row);
  return createJsonResponse({ status: "success", message: "Record added" });
}

function updateRecord(sheet, r) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === r.id.toString()) {
      var rowData = recordToRow(r);
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return createJsonResponse({ status: "success", message: "Record updated" });
    }
  }
  return createJsonResponse({ status: "error", message: "Record not found" });
}

function deleteRecord(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 1);
      return createJsonResponse({ status: "success", message: "Record deleted" });
    }
  }
  return createJsonResponse({ status: "error", message: "Record not found" });
}

function recordToRow(r) {
  var totalCollected = (r.collections || []).reduce(function(sum, c) {
    return sum + (Number(c.amount) || 0);
  }, 0);
  return [
    r.id, 
    r.title, 
    r.ownerName, 
    "'" + (r.mobile || ""), 
    r.amount, 
    r.collectionAmount, 
    totalCollected, 
    r.startDate, 
    r.duration, 
    r.area, 
    r.location, 
    r.contractorName || "",
    "'" + (r.contractorMobile || ""),
    r.contractorAddress || "",
    r.notes || "",
    JSON.stringify(r.collections || [])
  ];
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheetStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "চুক্তি_রেকর্ডস";
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length).setBackground("#002b5c").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function performSync(ss, records) {
  var sheet = ss.getSheetByName("চুক্তি_রেকর্ডস") || setupSheetStructure();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow, HEADERS.length).clearContent();

  if (records && records.length > 0) {
    var rows = records.map(recordToRow);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    sheet.getRange(2, 5, rows.length, 3).setNumberFormat("#,##0 \"৳\"");
  }
  return createJsonResponse({ status: "success", count: records.length });
}

function renderPrintView(sheet, id) {
  var data = sheet.getDataRange().getValues();
  var r = null;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id.toString()) {
      r = data[i];
      break;
    }
  }
  
  if (!r) return ContentService.createTextOutput("Record not found").setMimeType(ContentService.MimeType.TEXT);
  
  var html = "<html><head><title>Print Report</title><style>body{font-family:sans-serif;padding:40px;} .card{border:2px solid #002b5c;padding:30px;border-radius:20px;} h1{color:#002b5c;} .row{display:flex;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:5px;}</style></head><body>";
  html += "<div class='card'><h1>চুক্তিপত্র: " + r[1] + "</h1>";
  html += "<div class='row'><span>মালিক:</span> <b>" + r[2] + "</b></div>";
  html += "<div class='row'><span>চুক্তিধর:</span> <b>" + r[11] + "</b></div>";
  html += "<div class='row'><span>বিনিয়োগ:</span> <b>" + r[4] + " ৳</b></div>";
  html += "<div class='row'><span>পরিমাণ:</span> <b>" + r[9] + " শতক</b></div>";
  html += "<div class='row'><span>জমির ঠিকানা:</span> <i>" + r[10] + "</i></div>";
  html += "<p>তারিখ: " + new Date().toLocaleDateString('bn-BD') + "</p></div>";
  html += "<script>window.print();</script></body></html>";
  
  return HtmlService.createHtmlOutput(html);
}
