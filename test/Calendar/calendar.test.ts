import { Context } from '../../src/context';
import { Settings } from '../../src/settings';
import { CalendarSync } from '../../src/Calendar/calendar';
import { Meeting } from '../../src/Calendar/meeting';

// Mock Meeting class
jest.mock('../../src/Calendar/meeting', () => ({
  Meeting: jest.fn().mockImplementation((ctx, event) => ({
    ctx,
    event,
    title: event.summary || 'Test Meeting',
    note: jest.fn(() => null),
    blockers: jest.fn(() => null),
    isExternal: jest.fn(() => false),
    is1to1: jest.fn(() => false),
    createBlocker: jest.fn(() => true),
    removeBlocker: jest.fn(),
    createNote: jest.fn(),
    updateNote: jest.fn(),
    removeNote: jest.fn(),
    colorize: jest.fn(),
  })),
}));

// Mock Google Apps Script APIs
const mockCalendar = {
  getId: jest.fn(() => 'test-calendar-id'),
};

const mockProperties = {
  getProperty: jest.fn(),
  setProperty: jest.fn(),
  deleteProperty: jest.fn(),
};

const mockEvents = {
  items: [
    {
      id: 'event-1',
      summary: 'Test Meeting 1',
      status: 'confirmed',
      start: { dateTime: '2024-01-15T14:00:00Z' },
      end: { dateTime: '2024-01-15T15:00:00Z' },
    },
    {
      id: 'event-2',
      summary: 'Test Meeting 2',
      status: 'cancelled',
      start: { dateTime: '2024-01-15T16:00:00Z' },
      end: { dateTime: '2024-01-15T17:00:00Z' },
    },
  ],
  nextPageToken: null,
  nextSyncToken: 'next-sync-token',
};

// Mock Google Apps Script globals
(global as any).CalendarApp = {
  getDefaultCalendar: jest.fn(() => mockCalendar),
};

(global as any).PropertiesService = {
  getUserProperties: jest.fn(() => mockProperties),
};

(global as any).Calendar = {
  Events: {
    list: jest.fn(() => mockEvents),
  },
};

describe('CalendarSync', () => {
  let ctx: Context;
  let calendarSync: CalendarSync;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = new Context(new Settings());
    ctx.DEBUG = false;
    ctx.initialized = true;
    ctx.log = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    calendarSync = new CalendarSync(ctx, {
      colorize: true,
      blocker: true,
      meetingToNote: true,
    });
  });

  describe('constructor', () => {
    it('should initialize with proper configuration', () => {
      expect(calendarSync.ctx).toBe(ctx);
      expect(calendarSync.cal).toBe(mockCalendar);
      expect(calendarSync.properties).toBe(mockProperties);
      expect(calendarSync.config.colorize).toBe(true);
      expect(calendarSync.config.blocker).toBe(true);
      expect(calendarSync.config.meetingToNote).toBe(true);
    });

    it('should get sync token from properties', () => {
      mockProperties.getProperty.mockReturnValue('test-sync-token');

      const newCalendarSync = new CalendarSync(ctx, {
        colorize: false,
        blocker: false,
        meetingToNote: false,
      });

      expect(newCalendarSync.syncToken).toBe('test-sync-token');
    });
  });

  describe('sync', () => {
    it('should process events and create notes for new meetings', () => {
      const mockMeeting = {
        title: 'Test Meeting 1',
        event: { status: 'confirmed' },
        note: jest.fn(() => null), // No existing note
        blockers: jest.fn(() => null), // No existing blocker
        isExternal: jest.fn(() => true),
        is1to1: jest.fn(() => false),
        createBlocker: jest.fn(() => true),
        createNote: jest.fn(),
        colorize: jest.fn(),
      };

      (Meeting as jest.Mock).mockReturnValue(mockMeeting);

      calendarSync.sync();

      expect(mockMeeting.createBlocker).toHaveBeenCalledWith(mockCalendar);
      expect(mockMeeting.createNote).toHaveBeenCalled();
      expect(mockMeeting.colorize).toHaveBeenCalled();
    });

    it('should update existing notes for updated meetings', () => {
      const mockMeeting = {
        title: 'Test Meeting 1',
        event: { status: 'confirmed' },
        note: jest.fn(() => ({ id: 'existing-note' })), // Existing note
        blockers: jest.fn(() => [{ id: 'existing-blocker' }]), // Existing blocker
        isExternal: jest.fn(() => true),
        is1to1: jest.fn(() => false),
        updateNote: jest.fn(),
        colorize: jest.fn(),
      };

      (Meeting as jest.Mock).mockReturnValue(mockMeeting);

      calendarSync.sync();

      expect(mockMeeting.updateNote).toHaveBeenCalled();
      expect(mockMeeting.colorize).toHaveBeenCalled();
      expect(ctx.log.debug).toHaveBeenCalledWith(
        'Updated note for Test Meeting 1'
      );
    });

    it('should mark notes as cancelled for cancelled meetings', () => {
      const mockMeeting = {
        title: 'Test Meeting 2',
        event: { status: 'cancelled' },
        note: jest.fn(() => ({ id: 'existing-note' })), // Existing note
        blockers: jest.fn(() => [{ id: 'existing-blocker' }]), // Existing blocker
        isExternal: jest.fn(() => true),
        is1to1: jest.fn(() => false),
        removeBlocker: jest.fn(),
        removeNote: jest.fn(),
      };

      (Meeting as jest.Mock).mockReturnValue(mockMeeting);

      calendarSync.sync();

      expect(mockMeeting.removeBlocker).toHaveBeenCalledWith(mockCalendar);
      expect(mockMeeting.removeNote).toHaveBeenCalled();
      expect(ctx.log.debug).toHaveBeenCalledWith(
        'Meeting Test Meeting 2 was cancelled'
      );
    });

    it('should handle 1-to-1 internal meetings', () => {
      const mockMeeting = {
        title: '1-to-1 Meeting',
        event: { status: 'confirmed' },
        note: jest.fn(() => null), // No existing note
        blockers: jest.fn(() => null),
        isExternal: jest.fn(() => false),
        is1to1: jest.fn(() => true),
        createNote: jest.fn(),
        colorize: jest.fn(),
      };

      (Meeting as jest.Mock).mockReturnValue(mockMeeting);

      calendarSync.sync();

      expect(mockMeeting.createNote).toHaveBeenCalled();
      expect(mockMeeting.colorize).toHaveBeenCalled();
    });

    it('should skip block events', () => {
      const mockMeeting = {
        title: 'block',
        event: { status: 'confirmed' },
        note: jest.fn(),
        blockers: jest.fn(),
        isExternal: jest.fn(),
        is1to1: jest.fn(),
        createNote: jest.fn(),
        colorize: jest.fn(),
      };

      (Meeting as jest.Mock).mockReturnValue(mockMeeting);

      calendarSync.sync();

      expect(mockMeeting.createNote).not.toHaveBeenCalled();
      expect(mockMeeting.colorize).not.toHaveBeenCalled();
    });

    it('should skip all-day events', () => {
      const allDayEvent = {
        id: 'all-day-event',
        summary: 'All Day Event',
        status: 'confirmed',
        start: { date: '2024-01-15' }, // date instead of dateTime
        end: { date: '2024-01-15' },
      };

      const mockEventsWithAllDay = {
        ...mockEvents,
        items: [allDayEvent],
      };

      (global as any).Calendar.Events.list.mockReturnValue(
        mockEventsWithAllDay
      );

      const mockMeeting = {
        title: 'All Day Event',
        event: allDayEvent,
        note: jest.fn(),
        blockers: jest.fn(),
        isExternal: jest.fn(() => true),
        is1to1: jest.fn(),
        createNote: jest.fn(),
        colorize: jest.fn(),
      };

      (Meeting as jest.Mock).mockReturnValue(mockMeeting);

      calendarSync.sync();

      expect(mockMeeting.createNote).not.toHaveBeenCalled();
      expect(ctx.log.info).toHaveBeenCalledWith('All Day Event (1/15/2024)');
    });

    it('should handle sync token invalidation', () => {
      const error = new Error(
        'Sync token is no longer valid, a full sync is required.'
      );
      (global as any).Calendar.Events.list.mockImplementation(() => {
        throw error;
      });

      // Mock the sync method to prevent infinite recursion
      const originalSync = calendarSync.sync.bind(calendarSync);
      calendarSync.sync = jest.fn().mockImplementation(fullSync => {
        if (fullSync) {
          // For full sync, just return without calling original
          return;
        }
        // For regular sync, call original which will trigger the error
        return originalSync(fullSync);
      });

      calendarSync.sync();

      expect(mockProperties.deleteProperty).toHaveBeenCalledWith('syncToken');
      expect(calendarSync.sync).toHaveBeenCalledWith(true);
    });

    it('should handle full sync', () => {
      // Mock Calendar.Events.list to return empty result to prevent infinite loop
      (global as any).Calendar.Events.list.mockReturnValue({
        items: [],
        nextPageToken: null,
        nextSyncToken: 'next-sync-token',
      });

      calendarSync.sync(true);

      expect(mockProperties.deleteProperty).toHaveBeenCalledWith('syncToken');
      expect(mockProperties.deleteProperty).toHaveBeenCalledWith('pageToken');
      expect((global as any).Calendar.Events.list).toHaveBeenCalledWith(
        'test-calendar-id',
        expect.objectContaining({
          singleEvents: false,
          timeMin: expect.any(String),
          timeMax: expect.any(String),
          showDeleted: false,
        })
      );
    });

    it('should use sync token for incremental sync', () => {
      calendarSync.syncToken = 'test-sync-token';

      // Mock Calendar.Events.list to return empty result to prevent infinite loop
      (global as any).Calendar.Events.list.mockReturnValue({
        items: [],
        nextPageToken: null,
        nextSyncToken: 'next-sync-token',
      });

      calendarSync.sync();

      expect((global as any).Calendar.Events.list).toHaveBeenCalledWith(
        'test-calendar-id',
        expect.objectContaining({
          syncToken: 'test-sync-token',
        })
      );
    });

    it('should update sync token after successful sync', () => {
      // Mock Calendar.Events.list to return empty result to prevent infinite loop
      (global as any).Calendar.Events.list.mockReturnValue({
        items: [],
        nextPageToken: null,
        nextSyncToken: 'next-sync-token',
      });

      calendarSync.sync();

      expect(mockProperties.setProperty).toHaveBeenCalledWith(
        'syncToken',
        'next-sync-token'
      );
      expect(mockProperties.setProperty).toHaveBeenCalledWith('pageToken', '');
    });

    it('should not update sync token in DEBUG mode', () => {
      ctx.DEBUG = true;

      // Mock Calendar.Events.list to return empty result to prevent infinite loop
      (global as any).Calendar.Events.list.mockReturnValue({
        items: [],
        nextPageToken: null,
        nextSyncToken: 'next-sync-token',
      });

      calendarSync.sync();

      expect(mockProperties.setProperty).not.toHaveBeenCalled();
    });

    it('should log summary statistics', () => {
      const mockMeeting = {
        title: 'Test Meeting',
        event: { status: 'confirmed' },
        note: jest.fn(() => null),
        blockers: jest.fn(() => null),
        isExternal: jest.fn(() => true),
        is1to1: jest.fn(() => false),
        createBlocker: jest.fn(() => true),
        createNote: jest.fn(),
        colorize: jest.fn(),
      };

      (Meeting as jest.Mock).mockReturnValue(mockMeeting);

      // Mock Calendar.Events.list to return events to test statistics
      (global as any).Calendar.Events.list.mockReturnValue({
        items: [mockEvents.items[0]], // Return one event
        nextPageToken: null,
        nextSyncToken: 'next-sync-token',
      });

      calendarSync.sync();

      expect(ctx.log.info).toHaveBeenCalledWith('1 blockers created');
      expect(ctx.log.info).toHaveBeenCalledWith('1 notes created');
    });
  });
});
