import { buildContactMap } from '../../src/Calendar/gcontacts';

// Mock Google Apps Script globals
const mockConnections = [
  {
    names: [{ displayName: 'John Doe' }],
    emailAddresses: [{ value: 'john.doe@acme.com' }],
  },
  {
    names: [{ displayName: 'Jane Smith' }],
    emailAddresses: [
      { value: 'jane@acme.com' },
      { value: 'jane.smith@personal.com' },
    ],
  },
  {
    // No name — should be skipped
    emailAddresses: [{ value: 'noname@acme.com' }],
  },
];

const mockFetch = jest.fn(() => ({
  getContentText: jest.fn(() =>
    JSON.stringify({ connections: mockConnections })
  ),
}));

(global as any).ScriptApp = {
  getOAuthToken: jest.fn(() => 'mock-token'),
};

(global as any).UrlFetchApp = {
  fetch: mockFetch,
};

describe('buildContactMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReturnValue({
      getContentText: jest.fn(() =>
        JSON.stringify({ connections: mockConnections })
      ),
    });
  });

  it('maps each email to the contact display name', () => {
    const map = buildContactMap();
    expect(map.get('john.doe@acme.com')).toBe('John Doe');
    expect(map.get('jane@acme.com')).toBe('Jane Smith');
    expect(map.get('jane.smith@personal.com')).toBe('Jane Smith');
  });

  it('skips contacts with no name', () => {
    const map = buildContactMap();
    expect(map.has('noname@acme.com')).toBe(false);
  });

  it('returns empty map when API returns no connections', () => {
    mockFetch.mockReturnValueOnce({
      getContentText: jest.fn(() => JSON.stringify({})),
    });
    const map = buildContactMap();
    expect(map.size).toBe(0);
  });

  it('handles API errors gracefully', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockFetch.mockImplementationOnce(() => {
      throw new Error('API error');
    });
    const map = buildContactMap();
    expect(map.size).toBe(0);
    consoleSpy.mockRestore();
  });

  it('calls the correct People API endpoint with auth token', () => {
    buildContactMap();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('people.googleapis.com/v1/people/me/connections'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock-token' },
      })
    );
  });

  it('follows pagination via nextPageToken', () => {
    mockFetch
      .mockReturnValueOnce({
        getContentText: jest.fn(() =>
          JSON.stringify({
            connections: [
              {
                names: [{ displayName: 'Page One' }],
                emailAddresses: [{ value: 'p1@acme.com' }],
              },
            ],
            nextPageToken: 'tok123',
          })
        ),
      })
      .mockReturnValueOnce({
        getContentText: jest.fn(() =>
          JSON.stringify({
            connections: [
              {
                names: [{ displayName: 'Page Two' }],
                emailAddresses: [{ value: 'p2@acme.com' }],
              },
            ],
          })
        ),
      });

    const map = buildContactMap();
    expect(map.get('p1@acme.com')).toBe('Page One');
    expect(map.get('p2@acme.com')).toBe('Page Two');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
