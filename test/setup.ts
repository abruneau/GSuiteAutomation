import MUrlFetchApp from './url-fetch/UrlFetchApp';

// Mock Google Apps Script APIs
(global as any).UrlFetchApp = MUrlFetchApp;

// Mock SpreadsheetApp
(global as any).SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => ({
    getSheetByName: jest.fn(() => ({
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [])
      })),
      appendRow: jest.fn(),
      getRange: jest.fn(() => ({
        setValue: jest.fn(),
        setFontWeight: jest.fn()
      })),
      insertSheet: jest.fn(() => ({
        appendRow: jest.fn(),
        getRange: jest.fn(() => ({
          setFontWeight: jest.fn()
        }))
      }))
    })),
    openById: jest.fn(),
    create: jest.fn()
  })),
  openById: jest.fn(),
  create: jest.fn()
};

// Mock PropertiesService
(global as any).PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    setProperty: jest.fn(),
    getProperty: jest.fn()
  }))
};

// Mock Logger
(global as any).Logger = {
  log: jest.fn()
};

// Mock GmailApp
(global as any).GmailApp = {
  getUserLabelByName: jest.fn(() => ({}))
}; 