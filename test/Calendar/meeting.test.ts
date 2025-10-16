import { Context } from '../../src/context';
import { Settings } from '../../src/settings';
import { Meeting } from '../../src/Calendar/meeting';
import { MeetingNote } from '../../src/Calendar/meetingToNote';

// Mock MeetingNote
jest.mock('../../src/Calendar/meetingToNote', () => ({
  MeetingNote: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockReturnThis(),
    save: jest.fn(),
    update: jest.fn(),
    markAsCancelled: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock Google Apps Script APIs
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

const mockDriveFile = {
  getId: jest.fn(() => 'test-file-id'),
  getName: jest.fn(() => 'test-file.md'),
};

const mockDriveFolder = {
  getFilesByName: jest.fn(() => ({
    hasNext: jest.fn(() => false),
    next: jest.fn(() => mockDriveFile),
  })),
};

const mockCalendar = {
  getEventById: jest.fn(() => ({
    getColor: jest.fn(() => ''),
    setColor: jest.fn(),
  })),
  getEvents: jest.fn(() => []),
  createEvent: jest.fn(() => ({
    getId: jest.fn(() => 'blocker-event-id'),
    setDescription: jest.fn(),
  })),
};

// Mock Google Apps Script globals
(global as any).DriveApp = {
  getFileById: jest.fn(() => mockDriveFile),
  getFolderById: jest.fn(() => mockDriveFolder),
};

(global as any).CalendarApp = {
  getDefaultCalendar: jest.fn(() => mockCalendar),
  EventColor: {
    PALE_RED: 'PALE_RED',
    PALE_GREEN: 'PALE_GREEN',
  },
};

(global as any).Utilities = {
  formatDate: jest.fn((date, timezone, format) => {
    const d = new Date(date);
    if (format === 'yyyy-MM-dd') return '2024-01-15';
    return d.toISOString();
  }),
};

describe('Meeting', () => {
  let ctx: Context;
  let meeting: Meeting;

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

    meeting = new Meeting(ctx, mockCalendarEvent as any);
  });

  describe('constructor', () => {
    it('should initialize with proper title formatting', () => {
      expect(meeting.title).toBe('Test Meeting');
      expect(meeting.event).toBe(mockCalendarEvent);
      expect(meeting.ctx).toBe(ctx);
    });

    it('should format title by removing special characters', () => {
      const eventWithSpecialChars = {
        ...mockCalendarEvent,
        summary: 'Test/Meeting: #1 [Important]',
      };
      const meetingWithSpecialChars = new Meeting(
        ctx,
        eventWithSpecialChars as any
      );

      expect(meetingWithSpecialChars.title).toBe('TestMeeting 1 Important');
    });
  });

  describe('fileName', () => {
    it('should generate proper filename', () => {
      const fileName = meeting.fileName('2024-01-15T14:00:00Z');
      expect(fileName).toBe('2024-01-15_Test_Meeting.md');
    });

    it('should replace spaces with underscores in title', () => {
      const eventWithSpaces = {
        ...mockCalendarEvent,
        summary: 'Test Meeting With Spaces',
      };
      const meetingWithSpaces = new Meeting(ctx, eventWithSpaces as any);
      const fileName = meetingWithSpaces.fileName('2024-01-15T14:00:00Z');

      expect(fileName).toBe('2024-01-15_Test_Meeting_With_Spaces.md');
    });
  });

  describe('note', () => {
    it('should return file by stored ID', () => {
      meeting.event.extendedProperties = {
        private: { note: 'stored-file-id' },
      };

      const result = meeting.note();

      expect(DriveApp.getFileById).toHaveBeenCalledWith('stored-file-id');
      expect(result).toBe(mockDriveFile);
    });

    it('should fallback to filename search when stored ID fails', () => {
      meeting.event.extendedProperties = {
        private: { note: 'invalid-file-id' },
      };

      (DriveApp.getFileById as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = meeting.note();

      expect(ctx.log.debug).toHaveBeenCalledWith(
        'Note file with ID invalid-file-id not found, falling back to filename search'
      );
      expect(DriveApp.getFolderById).toHaveBeenCalledWith('test-folder-id');
    });

    it('should store file ID when found via filename search', () => {
      meeting.event.extendedProperties = { private: {} };
      mockDriveFolder.getFilesByName.mockReturnValue({
        hasNext: jest.fn(() => true),
        next: jest.fn(() => mockDriveFile),
      });

      meeting.note();

      expect(meeting.event.extendedProperties?.private?.['note']).toBe(
        'test-file-id'
      );
    });

    it('should return null when no file found', () => {
      meeting.event.extendedProperties = { private: {} };
      mockDriveFolder.getFilesByName.mockReturnValue({
        hasNext: jest.fn(() => false),
        next: jest.fn(() => mockDriveFile),
      });

      const result = meeting.note();

      expect(result).toBeNull();
    });
  });

  describe('storeNoteId', () => {
    it('should store note ID in existing extended properties', () => {
      meeting.event.extendedProperties = {
        private: { existing: 'value' },
      };

      (meeting as any).storeNoteId('new-file-id');

      expect(meeting.event.extendedProperties?.private?.['note']).toBe(
        'new-file-id'
      );
      expect(meeting.event.extendedProperties?.private?.['existing']).toBe(
        'value'
      );
    });

    it('should create extended properties if they do not exist', () => {
      meeting.event.extendedProperties = undefined;

      (meeting as any).storeNoteId('new-file-id');

      expect(meeting.event.extendedProperties).toEqual({
        private: { note: 'new-file-id' },
      });
    });
  });

  describe('attendees', () => {
    it('should return unique attendees including organizer and creator', () => {
      const attendees = meeting.attendees();

      expect(attendees).toHaveLength(3); // attendee + organizer + creator
      expect(attendees.map(a => a.email)).toContain('test@example.com');
      expect(attendees.map(a => a.email)).toContain('organizer@example.com');
      expect(attendees.map(a => a.email)).toContain('creator@example.com');
    });

    it('should filter out empty emails', () => {
      const eventWithEmptyEmails = {
        ...mockCalendarEvent,
        attendees: [
          { email: 'test@example.com', displayName: 'Test User', self: false },
          { email: '', displayName: 'Empty Email', self: false },
        ],
        organizer: { email: '', displayName: 'Empty Organizer', self: true },
      };
      const meetingWithEmptyEmails = new Meeting(
        ctx,
        eventWithEmptyEmails as any
      );

      const attendees = meetingWithEmptyEmails.attendees();
      expect(attendees.every(a => a.email !== '')).toBe(true);
    });

    it('should cache attendees list', () => {
      const attendees1 = meeting.attendees();
      const attendees2 = meeting.attendees();

      expect(attendees1).toBe(attendees2); // Same reference
    });
  });

  describe('isExternal', () => {
    it('should return true when external attendees present', () => {
      // Mock the attendees method to return emails with isExternal behavior
      jest.spyOn(meeting, 'attendees').mockReturnValue([
        { email: 'test@example.com', isExternal: jest.fn(() => true) } as any,
        {
          email: 'organizer@example.com',
          isExternal: jest.fn(() => false),
        } as any,
        {
          email: 'creator@example.com',
          isExternal: jest.fn(() => false),
        } as any,
      ]);

      const result = meeting.isExternal();
      expect(result).toBe(true);
    });

    it('should return false when no external attendees', () => {
      // Mock the attendees method to return emails with isExternal behavior
      jest.spyOn(meeting, 'attendees').mockReturnValue([
        {
          email: 'test@example.com',
          isExternal: jest.fn(() => false),
        } as any,
        {
          email: 'organizer@example.com',
          isExternal: jest.fn(() => false),
        } as any,
        {
          email: 'creator@example.com',
          isExternal: jest.fn(() => false),
        } as any,
      ]);

      const result = meeting.isExternal();
      expect(result).toBe(false);
    });
  });

  describe('is1to1', () => {
    it('should return true for 2 attendees', () => {
      // Mock the attendees method to return exactly 2 attendees
      jest
        .spyOn(meeting, 'attendees')
        .mockReturnValue([
          { email: 'user1@example.com' } as any,
          { email: 'user2@example.com' } as any,
        ]);

      expect(meeting.is1to1()).toBe(true);
    });

    it('should return false for more than 2 attendees', () => {
      // Use the default mock which returns 3 attendees
      expect(meeting.is1to1()).toBe(false); // Has 3 attendees (attendee + organizer + creator)
    });
  });

  describe('createNote', () => {
    it('should create and save a new note', () => {
      const mockMeetingNote = {
        create: jest.fn().mockReturnThis(),
        save: jest.fn(),
      };
      (MeetingNote as jest.Mock).mockReturnValue(mockMeetingNote);

      meeting.createNote();

      expect(MeetingNote).toHaveBeenCalledWith(meeting);
      expect(mockMeetingNote.create).toHaveBeenCalled();
      expect(mockMeetingNote.save).toHaveBeenCalled();
    });
  });

  describe('updateNote', () => {
    it('should create and update an existing note', () => {
      const mockMeetingNote = {
        create: jest.fn().mockReturnThis(),
        update: jest.fn(),
      };
      (MeetingNote as jest.Mock).mockReturnValue(mockMeetingNote);

      meeting.updateNote();

      expect(MeetingNote).toHaveBeenCalledWith(meeting);
      expect(mockMeetingNote.create).toHaveBeenCalled();
      expect(mockMeetingNote.update).toHaveBeenCalled();
    });
  });

  describe('removeNote', () => {
    it('should mark note as cancelled', () => {
      const mockMeetingNote = {
        markAsCancelled: jest.fn(),
      };
      (MeetingNote as jest.Mock).mockReturnValue(mockMeetingNote);

      meeting.removeNote();

      expect(MeetingNote).toHaveBeenCalledWith(meeting);
      expect(mockMeetingNote.markAsCancelled).toHaveBeenCalled();
    });
  });

  describe('colorize', () => {
    it('should set color for external meetings', () => {
      const mockEvent = {
        getColor: jest.fn(() => ''),
        setColor: jest.fn(),
      };
      mockCalendar.getEventById.mockReturnValue(mockEvent);

      // Mock isExternal to return true
      jest.spyOn(meeting, 'isExternal').mockReturnValue(true);

      meeting.colorize();

      expect(mockEvent.setColor).toHaveBeenCalledWith('PALE_RED');
    });

    it('should set color for 1-to-1 meetings', () => {
      const mockEvent = {
        getColor: jest.fn(() => ''),
        setColor: jest.fn(),
      };
      mockCalendar.getEventById.mockReturnValue(mockEvent);

      // Mock isExternal to return false and is1to1 to return true
      jest.spyOn(meeting, 'isExternal').mockReturnValue(false);
      jest.spyOn(meeting, 'is1to1').mockReturnValue(true);

      meeting.colorize();

      expect(mockEvent.setColor).toHaveBeenCalledWith('PALE_GREEN');
    });

    it('should not change color if already modified', () => {
      const mockEvent = {
        getColor: jest.fn(() => 'RED'),
        setColor: jest.fn(),
      };
      mockCalendar.getEventById.mockReturnValue(mockEvent);

      meeting.colorize();

      expect(mockEvent.setColor).not.toHaveBeenCalled();
    });
  });
});
