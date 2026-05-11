import { createStubContact } from '../../src/Calendar/stubContact';
import { Context } from '../../src/context';
import { Settings } from '../../src/settings';

const mockFile = { getId: jest.fn(() => 'stub-id') };
const mockFolder = {
  getFilesByName: jest.fn(() => ({ hasNext: jest.fn(() => false) })),
  createFile: jest.fn(() => mockFile),
};

(global as any).DriveApp = {
  getFolderById: jest.fn(() => mockFolder),
};

(global as any).Utilities = {
  formatDate: jest.fn(() => '2024-01-15 10:00'),
};

describe('createStubContact', () => {
  let ctx: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = new Context(new Settings());
    ctx.CONTACTS_FOLDER_ID = 'contacts-folder-id';
    ctx.DEBUG = false;
    ctx.log = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    ctx.ACCOUNTS = { get: jest.fn(() => ({ name: 'Acme Corp' })) } as any;
    ctx.tldsDB = { get: jest.fn(() => ({ level: 1 })) } as any;
  });

  it('creates a markdown file with correct frontmatter', () => {
    createStubContact(ctx, 'john.doe@acme.com', 'John Doe');
    expect(mockFolder.createFile).toHaveBeenCalled();
    const [fileName, content] = (mockFolder.createFile as jest.Mock).mock.calls[0];
    expect(fileName).toBe('John Doe.md');
    expect(content).toContain('title: John Doe');
    expect(content).toContain('tags:\n  - contacts');
    expect(content).toContain('Email:: john.doe@acme.com');
    expect(content).toContain('Company:: [[Acme Corp]]');
  });

  it('skips creation if file already exists', () => {
    mockFolder.getFilesByName.mockReturnValueOnce({ hasNext: jest.fn(() => true) });
    createStubContact(ctx, 'john.doe@acme.com', 'John Doe');
    expect(mockFolder.createFile).not.toHaveBeenCalled();
  });

  it('leaves Company empty when domain is unknown', () => {
    (ctx.ACCOUNTS.get as jest.Mock).mockReturnValueOnce(undefined);
    createStubContact(ctx, 'unknown@mystery.com', 'Unknown Person');
    const content = (mockFolder.createFile as jest.Mock).mock.calls[0][1];
    expect(content).toContain('Company:: ');
    expect(content).not.toContain('[[');
  });

  it('does nothing when CONTACTS_FOLDER_ID is not configured', () => {
    ctx.CONTACTS_FOLDER_ID = '';
    createStubContact(ctx, 'john.doe@acme.com', 'John Doe');
    expect(mockFolder.createFile).not.toHaveBeenCalled();
  });

  it('does not create files in DEBUG mode', () => {
    ctx.DEBUG = true;
    createStubContact(ctx, 'john.doe@acme.com', 'John Doe');
    expect(mockFolder.createFile).not.toHaveBeenCalled();
    expect(DriveApp.getFolderById).not.toHaveBeenCalled();
  });
});
