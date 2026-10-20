import {
  bedLabelsFor,
  buildRoomWrites,
  chunkRoomWrites,
  emptyForm,
  formatRentRange,
  labelsLostBy,
  newRoom,
  parseRent,
  orderedPhotos,
  propertyFields,
  renumberAutoRooms,
  summarize,
  validateForm,
  type PropertyForm,
  type RoomDraft,
} from '@/features/properties/propertySetup';

const room = (over: Partial<RoomDraft> = {}): RoomDraft => ({
  key: 'k1',
  roomNumber: '101',
  numberAuto: false,
  floor: null,
  sharing: 2,
  ac: false,
  rent: '',
  bedLabels: [],
  ...over,
});
const form = (over: Partial<PropertyForm> = {}): PropertyForm => ({
  ...emptyForm(),
  name: 'Sunrise PG',
  location: 'MVP Colony',
  city: 'Visakhapatnam',
  state: 'Andhra Pradesh',
  postalCode: '530041',
  contactName: 'Ravi',
  contactPhone: '+91 98765 43210',
  ...over,
});

describe('validateForm', () => {
  it('requires name and location, trimmed', () => {
    const e = validateForm({ ...emptyForm(), name: '  ', location: '' });
    expect(e.name).toBeDefined();
    expect(e.location).toBeDefined();
    expect(validateForm(form()).name).toBeUndefined();
  });

  it('requires city, postal code and contact name and phone', () => {
    const e = validateForm({ ...emptyForm(), name: 'X', location: 'Y' });
    expect(e.city).toBeDefined();
    expect(e.state).toBeDefined();
    expect(e.postalCode).toBeDefined();
    expect(e.contactName).toBeDefined();
    expect(e.contactPhone).toBeDefined();
    const ok = validateForm(form());
    expect([ok.city, ok.postalCode, ok.contactName, ok.contactPhone]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('checks phone and postal formats', () => {
    expect(validateForm(form({ contactPhone: 'abc' })).contactPhone).toBeDefined();
    expect(validateForm(form({ contactPhone: '+91 98765 43210' })).contactPhone).toBeUndefined();
    expect(validateForm(form({ postalCode: '!!' })).postalCode).toBeDefined();
  });

  it('rejects duplicate room numbers per property, or per floor when floors are used', () => {
    const rooms = [room({ key: 'a' }), room({ key: 'b', roomNumber: ' 101 ' })];
    expect(Object.keys(validateForm(form({ rooms })).rooms)).toEqual(['b']);

    const onFloors = [room({ key: 'a', floor: 0 }), room({ key: 'b', floor: 1 })];
    expect(validateForm(form({ useFloors: true, rooms: onFloors })).rooms).toEqual({});
    const same = [room({ key: 'a', floor: 1 }), room({ key: 'b', floor: 1 })];
    expect(Object.keys(validateForm(form({ useFloors: true, rooms: same })).rooms)).toEqual(['b']);
  });

  it('flags a bad rent but accepts empty (not configured)', () => {
    expect(validateForm(form({ rooms: [room({ rent: '' })] })).rooms).toEqual({});
    expect(Object.keys(validateForm(form({ rooms: [room({ rent: '0' })] })).rooms)).toEqual(['k1']);
  });
});

describe('rent', () => {
  it('parses whole rupees only', () => {
    expect(parseRent('8500')).toBe(8500);
    expect(parseRent('')).toBeNull();
    expect(parseRent('85.5')).toBeNull();
    expect(parseRent('0')).toBeNull();
    expect(parseRent('2000000')).toBeNull();
  });

  it('derives min/max from rooms with a rent and reports not configured otherwise', () => {
    const s = summarize(
      form({ rooms: [room({ key: 'a', rent: '9000' }), room({ key: 'b', rent: '7000' }), room({ key: 'c' })] }),
    );
    expect(s.rent).toEqual({ min: 7000, max: 9000 });
    expect(s.roomsWithoutRent).toBe(1);
    expect(formatRentRange(s.rent)).toBe('₹7,000 – ₹9,000 / bed');
    expect(formatRentRange(summarize(form({ rooms: [room()] })).rent)).toBe('Not configured');
  });
});

describe('beds', () => {
  it('generates one bed per sharing slot with default or custom labels', () => {
    const r = room({ sharing: 3, bedLabels: ['Window', ''] });
    expect(bedLabelsFor(r)).toEqual(['Window', 'Bed 2', 'Bed 3']);
  });

  it('keeps custom labels and reports which a reduction would drop', () => {
    const r = room({ sharing: 3, bedLabels: ['A', 'B', 'C'] });
    expect(labelsLostBy(r, 2)).toEqual(['C']);
    expect(labelsLostBy(r, 3)).toEqual([]);
  });

  it('creates every bed available, with ids derived from the room key', () => {
    const [w] = buildRoomWrites(form({ rooms: [room({ sharing: 2, rent: '8000' })] }));
    expect(w.room).toMatchObject({ roomNumber: '101', sharing: 2, ac: false, rentPerBedInr: 8000 });
    expect(w.beds.map((b) => b.id)).toEqual(['k1_b1', 'k1_b2']);
    expect(w.beds.every((b) => b.data.status === 'available')).toBe(true);
  });

  it('omits floor unless floors are used, and rent unless set', () => {
    const [w] = buildRoomWrites(form({ rooms: [room({ floor: 2 })] }));
    expect(w.room).not.toHaveProperty('floor');
    expect(w.room).not.toHaveProperty('rentPerBedInr');
    const [f] = buildRoomWrites(form({ useFloors: true, rooms: [room({ floor: 2 })] }));
    expect(f.room).toHaveProperty('floor', 2);
  });
});

describe('chunkRoomWrites', () => {
  it('keeps a room with its beds and respects the document limit', () => {
    const rooms = Array.from({ length: 100 }, (_, i) => room({ key: `r${i}`, roomNumber: String(i), sharing: 4 }));
    const chunks = chunkRoomWrites(buildRoomWrites(form({ rooms })), 250);
    expect(chunks.flat()).toHaveLength(100);
    for (const chunk of chunks) {
      expect(chunk.reduce((n, w) => n + 1 + w.beds.length, 0)).toBeLessThanOrEqual(250);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('display image', () => {
  const shot = (n: number) => ({ uri: `file:///${n}.jpg`, mimeType: 'image/jpeg', fileSize: 100 });
  const [a, b, c] = [shot(1), shot(2), shot(3)];

  it('defaults to the first photo and puts the chosen one first without losing the rest', () => {
    expect(orderedPhotos(form({ photos: [a, b, c] }))).toEqual([a, b, c]);
    expect(orderedPhotos(form({ photos: [a, b, c], coverUri: c.uri }))).toEqual([c, a, b]);
  });

  it('falls back to the first photo if the chosen one was removed, and is empty without photos', () => {
    expect(orderedPhotos(form({ photos: [a, b], coverUri: c.uri }))).toEqual([a, b]);
    expect(orderedPhotos(form())).toEqual([]);
  });
});

describe('photos', () => {
  it('counts property and room photos separately', () => {
    const p = { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileSize: 100 };
    const s = summarize(
      form({ photos: [p, p], roomPhotos: [p, p, p, p], rooms: [room({ key: 'a' })] }),
    );
    expect(s.photos).toBe(2);
    expect(s.roomPhotos).toBe(4);
  });
});

describe('misc', () => {
  it('suggests unique-looking room numbers and copies settings when duplicating', () => {
    const first = newRoom([], 1);
    expect(first.roomNumber).toBe('101');
    const copy = newRoom([first], 1, { ...first, sharing: 3, ac: true, rent: '9000' });
    expect(copy).toMatchObject({ roomNumber: '102', sharing: 3, ac: true, rent: '9000' });
    expect(copy.key).not.toBe(first.key);
  });

  it('renumbers suggested room numbers when floors are switched on, but not typed ones', () => {
    const first = newRoom([], null);
    const second = newRoom([first], null);
    expect([first.roomNumber, second.roomNumber]).toEqual(['1', '2']);
    const typed = { ...second, roomNumber: 'A-7', numberAuto: false };
    const onGround = [first, typed].map((r) => ({ ...r, floor: 0 }));
    expect(renumberAutoRooms(onGround).map((r) => r.roomNumber)).toEqual(['G1', 'A-7']);
    expect(newRoom([], 0).roomNumber).toBe('G1');
  });

  it('drops empty optional property fields', () => {
    expect(propertyFields(form({ city: ' Vizag ', description: '  ' }))).toEqual({
      name: 'Sunrise PG',
      location: 'MVP Colony',
      contactName: 'Ravi',
      contactPhone: '+91 98765 43210',
      city: 'Vizag',
      state: 'Andhra Pradesh',
      postalCode: '530041',
    });
  });
});
