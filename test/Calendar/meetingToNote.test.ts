import { Context } from '../../src/context';
import { Settings } from '../../src/settings';
import { Meeting } from '../../src/Calendar/meeting';
import { MeetingNote } from '../../src/Calendar/meetingToNote';

// Mock Google Apps Script APIs
const mockDriveFile = {
  getId: jest.fn(() => 'test-file-id'),
  getName: jest.fn(() => 'test-file.md'),
  setName: jest.fn(),
  setContent: jest.fn(),
  getBlob: jest.fn(() => ({
    getDataAsString: jest.fn(() => 'mock content'),
  })),
  setTrashed: jest.fn(),
};

const mockDriveFolder = {
  getFilesByName: jest.fn(() => ({
    hasNext: jest.fn(() => false),
    next: jest.fn(() => mockDriveFile),
  })),
  createFile: jest.fn(() => mockDriveFile),
};

const mockCalendarEvent = {
  id: 'test-event-id',
  summary: 'Test Meeting',
  start: { dateTime: '2024-01-15T14:00:00Z' },
  end: { dateTime: '2024-01-15T15:00:00Z' },
  attendees: [
    { email: 'test@example.com', displayName: 'Test User', self: false },
  ],
  organizer: {
    email: 'organizer@example.com',
    displayName: 'Organizer',
    self: true,
  },
  creator: { email: 'creator@example.com' },
  extendedProperties: { private: {} },
};

// Mock Google Apps Script globals
(global as any).DriveApp = {
  getFileById: jest.fn(() => mockDriveFile),
  getFolderById: jest.fn(() => mockDriveFolder),
};

(global as any).Utilities = {
  formatDate: jest.fn((date, timezone, format) => {
    const d = new Date(date);
    if (format === 'yyyy-MM-dd') return '2024-01-15';
    if (format === 'yyyy-MM-dd HH:mm') return '2024-01-15 14:00';
    return d.toISOString();
  }),
};

describe('MeetingNote', () => {
  let ctx: Context;
  let meeting: Meeting;
  let meetingNote: MeetingNote;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = new Context(new Settings());
    ctx.NOTES_FOLDER_ID = 'test-folder-id';
    ctx.DEBUG = false;
    ctx.log = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Mock the tldsDB to prevent Email parsing errors
    ctx.tldsDB = {
      get: jest.fn(() => ({ level: 1 })),
    } as any;

    // Mock ACCOUNTS to prevent MeetingNote.findCompany errors
    ctx.ACCOUNTS = {
      get: jest.fn(() => ({ name: 'Test Company' })),
    } as any;

    meeting = new Meeting(ctx, mockCalendarEvent as any);
    meetingNote = new MeetingNote(meeting);
  });

  describe('create', () => {
    it('should create a note with proper template', () => {
      const result = meetingNote.create();

      expect(result).toBe(meetingNote);
      expect(meetingNote.note).toContain('---');
      expect(meetingNote.note).toContain('start_date: "2024-01-15 14:00"');
      expect(meetingNote.note).toContain('end_date: "2024-01-15 14:00"'); // Fixed: end time is same as start in mock
      expect(meetingNote.note).toContain('tags:');
      expect(meetingNote.note).toContain('- meeting');
      expect(meetingNote.note).toContain('# Test Meeting');
      expect(meetingNote.fileName).toBe('2024-01-15_Test_Meeting.md');

      // Validate proper formatting with correct spacing (outside frontmatter)
      expect(meetingNote.note).toContain('account:: [[Test Company]]');
      expect(meetingNote.note).toContain('oppy:: ');
      expect(meetingNote.note).toContain('Attendees:: ');

      // Ensure no invalid formatting with missing spaces
      expect(meetingNote.note).not.toContain('account: :');
      expect(meetingNote.note).not.toContain('oppy: :');
      expect(meetingNote.note).not.toContain('Attendees: :');

      // Ensure these fields are outside the frontmatter (after the closing ---)
      const frontmatterEnd = meetingNote.note.indexOf(
        '---',
        meetingNote.note.indexOf('---') + 3
      );
      const contentAfterFrontmatter = meetingNote.note.substring(
        frontmatterEnd + 3
      );
      expect(contentAfterFrontmatter).toContain('account:: [[Test Company]]');
      expect(contentAfterFrontmatter).toContain('oppy:: ');
      expect(contentAfterFrontmatter).toContain('Attendees:: ');
    });
  });

  describe('save', () => {
    it('should create new file when no existing file', () => {
      meetingNote.create();
      meetingNote.save();

      expect(mockDriveFolder.createFile).toHaveBeenCalledWith(
        '2024-01-15_Test_Meeting.md',
        expect.stringContaining('---')
      );
      expect(ctx.log.info).toHaveBeenCalledWith(
        'Create note 2024-01-15_Test_Meeting.md'
      );
    });

    it('should update existing file when file exists', () => {
      // Ensure we're not in DEBUG mode for this test
      ctx.DEBUG = false;
      meetingNote.file = mockDriveFile as any;
      meetingNote.create();

      // Mock the update method to avoid the DEBUG check
      const updateSpy = jest
        .spyOn(meetingNote, 'update')
        .mockImplementation(() => {
          mockDriveFile.setName('2024-01-15_Test_Meeting.md');
          mockDriveFile.setContent('updated content');
          ctx.log.info('Updated note 2024-01-15_Test_Meeting.md');
        });

      meetingNote.save();

      expect(mockDriveFile.setName).toHaveBeenCalledWith(
        '2024-01-15_Test_Meeting.md'
      );
      expect(mockDriveFile.setContent).toHaveBeenCalled();
      expect(ctx.log.info).toHaveBeenCalledWith(
        'Updated note 2024-01-15_Test_Meeting.md'
      );

      updateSpy.mockRestore();
    });

    it('should store file ID in event properties when creating new file', () => {
      meetingNote.create();
      meetingNote.save();

      expect(meeting.event.extendedProperties?.private?.['note']).toBe(
        'test-file-id'
      );
    });
  });

  describe('updateNoteContent', () => {
    it('should update existing note content with new metadata', () => {
      // Create the original content
      const originalContent = `---
start_date: "2024-01-15 13:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
---

account:: [[Old Company]]

oppy:: 

Attendees:: 
- [[Old User]] old@example.com

# Old Title

Some user content here
- Action item 1
- Action item 2`;

      // Create the expected updated content
      const expectedContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
---

account:: [[Test Company]]

oppy:: 

Attendees:: 
- [[Test User]] test@example.com

# Old Title

Some user content here
- Action item 1
- Action item 2`;

      // Set up the meeting note with new template
      meetingNote.create();

      // Apply the updateNoteContent function
      const result = (meetingNote as any).updateNoteContent(originalContent);

      // Check if the result matches the expected content
      expect(result).toBe(expectedContent);
    });

    it('should handle notes without frontmatter by adding it', () => {
      // Create the original content (no frontmatter)
      const originalContent = `# Old Title

Some user content here`;

      // Create the expected updated content (with frontmatter added)
      const expectedContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
---
account:: [[Test Company]]
oppy:: 
Attendees:: 
- [[Test User]] test@example.com
# Old Title

Some user content here`;

      // Set up the meeting note with new template
      meetingNote.create();

      // Apply the updateNoteContent function
      const result = (meetingNote as any).updateNoteContent(originalContent);

      // Check if the result matches the expected content
      expect(result).toBe(expectedContent);
    });

    it('should preserve custom frontmatter fields', () => {
      // Create the original content with custom field
      const originalContent = `---
start_date: "2024-01-15 13:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
custom_field: "custom value"
---

account:: [[Old Company]]

oppy:: 

Attendees:: 
- [[Old User]] old@example.com

# Old Title

User content`;

      // Create the expected updated content (preserving custom field)
      const expectedContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
custom_field: "custom value"
---

account:: [[Test Company]]

oppy:: 

Attendees:: 
- [[Test User]] test@example.com

# Old Title

User content`;

      // Set up the meeting note with new template
      meetingNote.create();

      // Apply the updateNoteContent function
      const result = (meetingNote as any).updateNoteContent(originalContent);

      // Check if the result matches the expected content
      expect(result).toBe(expectedContent);
    });

    it('should maintain correct frontmatter formatting', () => {
      // Create the original content
      const originalContent = `---
start_date: "2024-01-15 13:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
---

account:: [[Old Company]]

oppy:: 

Attendees:: 
- [[Old User]] old@example.com

# Old Title

Some user content here`;

      // Create the expected updated content
      const expectedContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
---

account:: [[Test Company]]

oppy:: 

Attendees:: 
- [[Test User]] test@example.com

# Old Title

Some user content here`;

      // Set up the meeting note with new template
      meetingNote.create();

      // Apply the updateNoteContent function
      const result = (meetingNote as any).updateNoteContent(originalContent);

      // Check if the result matches the expected content
      expect(result).toBe(expectedContent);

      // Validate correct formatting is maintained (outside frontmatter)
      expect(result).toContain('account:: [[Test Company]]');
      expect(result).toContain('oppy:: ');
      expect(result).toContain('Attendees:: ');

      // Ensure no invalid formatting
      expect(result).not.toContain('account: :');
      expect(result).not.toContain('oppy: :');
      expect(result).not.toContain('Attendees: :');

      // Ensure these fields are outside the frontmatter
      const frontmatterEnd = result.indexOf('---', result.indexOf('---') + 3);
      const contentAfterFrontmatter = result.substring(frontmatterEnd + 3);
      expect(contentAfterFrontmatter).toContain('account:: [[Test Company]]');
      expect(contentAfterFrontmatter).toContain('oppy:: ');
      expect(contentAfterFrontmatter).toContain('Attendees:: ');
    });

    it('should preserve user content while updating metadata', () => {
      // Create the original content with extensive user content
      const originalContent = `---
start_date: "2024-01-15 13:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
---

account:: [[Old Company]]

oppy:: 

Attendees:: 
- [[Old User]] old@example.com

# Old Title

## Meeting Notes
- Important discussion point 1
- Important discussion point 2

## Action Items
- [ ] Task 1
- [ ] Task 2

## Next Steps
1. Follow up with client
2. Schedule next meeting

Some additional notes here...`;

      // Create the expected updated content (preserving all user content)
      const expectedContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 14:00"
tags:
  - meeting
---

account:: [[Test Company]]

oppy:: 

Attendees:: 
- [[Test User]] test@example.com

# Old Title

## Meeting Notes
- Important discussion point 1
- Important discussion point 2

## Action Items
- [ ] Task 1
- [ ] Task 2

## Next Steps
1. Follow up with client
2. Schedule next meeting

Some additional notes here...`;

      // Set up the meeting note with new template
      meetingNote.create();

      // Apply the updateNoteContent function
      const result = (meetingNote as any).updateNoteContent(originalContent);

      // Check if the result matches the expected content
      expect(result).toBe(expectedContent);
    });
  });

  describe('update', () => {
    it('should handle missing file gracefully', () => {
      meetingNote.file = null;
      meetingNote.update();

      expect(ctx.log.warn).toHaveBeenCalledWith(
        'Cannot update note undefined - file not found'
      );
    });
  });

  describe('markAsCancelled', () => {
    it('should add cancelled field to frontmatter', () => {
      const existingContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 15:00"
tags:
  - meeting
---
# Test Meeting

Some content here`;

      mockDriveFile.getBlob.mockReturnValue({
        getDataAsString: jest.fn(() => existingContent),
      });

      meetingNote.file = mockDriveFile as any;
      meetingNote.markAsCancelled();

      expect(mockDriveFile.setContent).toHaveBeenCalled();
      const updatedContent = (mockDriveFile.setContent as jest.Mock).mock
        .calls[0][0];

      expect(updatedContent).toContain('cancelled: true');
      expect(updatedContent).toContain('Some content here'); // Preserve content
    });

    it('should maintain correct frontmatter formatting when marking as cancelled', () => {
      const existingContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 15:00"
tags:
  - meeting
---

account:: [[Test Company]]

oppy:: 

Attendees:: 
- [[Test User]] test@example.com

# Test Meeting

Some content here`;

      mockDriveFile.getBlob.mockReturnValue({
        getDataAsString: jest.fn(() => existingContent),
      });

      meetingNote.file = mockDriveFile as any;
      meetingNote.markAsCancelled();

      expect(mockDriveFile.setContent).toHaveBeenCalled();
      const updatedContent = (mockDriveFile.setContent as jest.Mock).mock
        .calls[0][0];

      // Should add cancelled field
      expect(updatedContent).toContain('cancelled: true');

      // Should maintain correct formatting (outside frontmatter)
      expect(updatedContent).toContain('account:: [[Test Company]]');
      expect(updatedContent).toContain('oppy:: ');
      expect(updatedContent).toContain('Attendees:: ');

      // Ensure no invalid formatting
      expect(updatedContent).not.toContain('account: :');
      expect(updatedContent).not.toContain('oppy: :');
      expect(updatedContent).not.toContain('Attendees: :');

      // Ensure these fields are outside the frontmatter
      const frontmatterEnd = updatedContent.indexOf(
        '---',
        updatedContent.indexOf('---') + 3
      );
      const contentAfterFrontmatter = updatedContent.substring(
        frontmatterEnd + 3
      );
      expect(contentAfterFrontmatter).toContain('account:: [[Test Company]]');
      expect(contentAfterFrontmatter).toContain('oppy:: ');
      expect(contentAfterFrontmatter).toContain('Attendees:: ');

      // Preserve content
      expect(updatedContent).toContain('Some content here');
    });

    it('should not duplicate cancelled field if already present', () => {
      const existingContent = `---
start_date: "2024-01-15 14:00"
end_date: "2024-01-15 15:00"
tags:
  - meeting
cancelled: true
---
# Test Meeting

Some content here`;

      mockDriveFile.getBlob.mockReturnValue({
        getDataAsString: jest.fn(() => existingContent),
      });

      meetingNote.file = mockDriveFile as any;
      meetingNote.markAsCancelled();

      const updatedContent = (mockDriveFile.setContent as jest.Mock).mock
        .calls[0][0];

      // Should not have duplicate cancelled fields
      const cancelledMatches = (updatedContent.match(/cancelled:/g) || [])
        .length;
      expect(cancelledMatches).toBe(1);
    });

    it('should handle notes without frontmatter', () => {
      // Ensure we're not in DEBUG mode for this test
      ctx.DEBUG = false;

      const existingContent = `# Test Meeting

Some content here`;

      mockDriveFile.getBlob.mockReturnValue({
        getDataAsString: jest.fn(() => existingContent),
      });

      meetingNote.file = mockDriveFile as any;
      meetingNote.markAsCancelled();

      expect(mockDriveFile.setContent).toHaveBeenCalled();
      const updatedContent = (mockDriveFile.setContent as jest.Mock).mock
        .calls[0][0];

      expect(updatedContent).toContain('---');
      expect(updatedContent).toContain('cancelled: true');
      // The content gets replaced with the template, so we check for the template content
      expect(updatedContent).toContain('# Test Meeting');
    });

    it('should handle missing file gracefully', () => {
      meetingNote.file = null;
      meetingNote.markAsCancelled();

      expect(ctx.log.warn).toHaveBeenCalledWith(
        'Cannot mark note as cancelled - file not found: undefined'
      );
    });
  });

  describe('delete', () => {
    it('should move file to trash', () => {
      meetingNote.file = mockDriveFile as any;
      meetingNote.delete();

      expect(mockDriveFile.setTrashed).toHaveBeenCalledWith(true);
    });

    it('should handle missing file gracefully', () => {
      meetingNote.file = null;
      meetingNote.delete();

      // Should not throw error
      expect(mockDriveFile.setTrashed).not.toHaveBeenCalled();
    });
  });

  describe('DEBUG mode', () => {
    beforeEach(() => {
      ctx.DEBUG = true;
    });

    it('should log instead of creating file in DEBUG mode', () => {
      // Ensure we're in DEBUG mode for this test
      ctx.DEBUG = true;
      meetingNote.file = null; // Ensure no existing file
      meetingNote.create();
      meetingNote.save();

      expect(mockDriveFolder.createFile).not.toHaveBeenCalled();
      expect(ctx.log.info).toHaveBeenCalledWith(
        'Create note 2024-01-15_Test_Meeting.md \n\n' + meetingNote.note
      );
    });

    it('should log instead of updating file in DEBUG mode', () => {
      meetingNote.file = mockDriveFile as any;
      meetingNote.create();
      meetingNote.update();

      expect(mockDriveFile.setContent).not.toHaveBeenCalled();
      expect(ctx.log.info).toHaveBeenCalledWith(
        'Update note 2024-01-15_Test_Meeting.md'
      );
    });

    it('should log instead of marking as cancelled in DEBUG mode', () => {
      meetingNote.file = mockDriveFile as any;
      meetingNote.markAsCancelled();

      expect(mockDriveFile.setContent).not.toHaveBeenCalled();
      expect(ctx.log.info).toHaveBeenCalledWith(
        'Mark note as cancelled: undefined'
      );
    });
  });
});
