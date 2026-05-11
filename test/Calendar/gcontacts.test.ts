import { buildContactMap } from '../../src/Calendar/gcontacts';

// Mock Google People API
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

(global as any).People = {
  People: {
    connections: {
      list: jest.fn(() => ({ connections: mockConnections })),
    },
  },
};

describe('buildContactMap', () => {
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

  it('returns empty map when People API returns no connections', () => {
    ((global as any).People.People.connections.list as jest.Mock).mockReturnValueOnce({});
    const map = buildContactMap();
    expect(map.size).toBe(0);
  });

  it('handles People API errors gracefully', () => {
    ((global as any).People.People.connections.list as jest.Mock).mockImplementationOnce(() => {
      throw new Error('API error');
    });
    const map = buildContactMap();
    expect(map.size).toBe(0);
  });
});
